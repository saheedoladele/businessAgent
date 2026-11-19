import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Thin wrapper around the Claude API used by every agent step.
 *
 * - `askText`  → plain text answer (e.g. an email body)
 * - `askJSON`  → structured answer validated with a zod schema
 * - `webSearch: true` lets Claude search the web server-side (used for lead discovery)
 */

let _client: Anthropic | undefined;
function client(): Anthropic {
  // Created lazily so importing this module never fails without a key (e.g. in tests).
  _client ??= new Anthropic({
    apiKey: resolveApiKey(),
    maxRetries: 3, // SDK retries 429 / 5xx with backoff
  });
  return _client;
}

/**
 * Read and sanity-check ANTHROPIC_API_KEY so a bad key fails with a clear
 * message instead of a bare 401 from the API.
 */
export function resolveApiKey(env: Record<string, string | undefined> = process.env): string {
  const key = (env.ANTHROPIC_API_KEY ?? "").trim().replace(/^["']|["']$/g, "");
  if (!key) {
    throw new AIError(
      "ANTHROPIC_API_KEY is empty. Create a key at https://console.anthropic.com/settings/keys and put it in .env",
    );
  }
  if (!key.startsWith("sk-ant-")) {
    throw new AIError(`ANTHROPIC_API_KEY doesn't look like an Anthropic key (starts with "${key.slice(0, 8)}…").`);
  }
  if (key.startsWith("sk-ant-oat")) {
    throw new AIError(
      "ANTHROPIC_API_KEY is a Claude.ai / Claude Code sign-in token, which doesn't work with the API. " +
        "Create an API key in the Claude Console instead.",
    );
  }
  return key;
}

/** Main model: web research and writing emails. */
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
/** Cheaper model for simple judgement calls: scoring leads, classifying replies. */
export const MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-5-5";

export interface AskOptions {
  /** Defaults to MODEL. Pass MODEL_FAST for cheap classification/scoring. */
  model?: string;
  system?: string;
  maxTokens?: number;
  temperature?: number;
  /** Allow Claude to search the web. Number = max searches for this call. */
  webSearch?: boolean | number;
  /** Restrict web search to (or away from) certain domains. */
  allowedDomains?: string[];
  blockedDomains?: string[];
}

/** Server-side tool turns can pause; we resume them up to this many times. */
const MAX_CONTINUATIONS = 5;

async function run(prompt: string, opts: AskOptions = {}): Promise<string> {
  const tools: Anthropic.Messages.ToolUnion[] = [];
  if (opts.webSearch) {
    tools.push({
      type: "web_search_20260318",
      name: "web_search",
      max_uses: typeof opts.webSearch === "number" ? opts.webSearch : 8,
      ...(opts.allowedDomains?.length ? { allowed_domains: opts.allowedDomains } : {}),
      ...(opts.blockedDomains?.length ? { blocked_domains: opts.blockedDomains } : {}),
    });
  }

  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: prompt }];

  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const res = await client().messages.create({
      model: opts.model ?? MODEL,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
      ...(opts.system ? { system: opts.system } : {}),
      ...(tools.length ? { tools } : {}),
      messages,
    });

    // Long web-search turns may pause; send the partial turn back to continue it.
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") {
      throw new AIError("Claude declined this request");
    }

    // With web search, the final answer is the text after the last tool result.
    const lastTool = res.content.findLastIndex((b) => b.type !== "text");
    const text = res.content
      .slice(lastTool + 1)
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!text) throw new AIError(`Empty response (stop_reason: ${res.stop_reason})`);
    return text;
  }
  throw new AIError("Claude did not finish after several continuations");
}

export class AIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIError";
  }
}

/** Ask for a plain-text answer. */
export function askText(prompt: string, opts?: AskOptions): Promise<string> {
  return run(prompt, opts);
}

/**
 * Ask for JSON matching `schema`. Claude is told the shape; if the answer
 * doesn't parse or validate, we retry once with the validation error.
 */
export async function askJSON<T extends z.ZodTypeAny>(
  schema: T,
  prompt: string,
  opts: AskOptions & { shapeHint?: string } = {},
): Promise<z.infer<T>> {
  const instructions =
    "\n\nRespond with ONLY valid JSON, no prose and no markdown fences." +
    (opts.shapeHint ? `\nThe JSON must have this shape:\n${opts.shapeHint}` : "");

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const retryNote = attempt
      ? `\n\nYour previous answer was invalid: ${lastError}\nReturn corrected JSON only.`
      : "";
    const raw = await run(prompt + instructions + retryNote, opts);
    try {
      const parsed = schema.safeParse(extractJSON(raw));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  throw new AIError(`Claude returned invalid JSON: ${lastError}`);
}

/** Pull a JSON value out of a model answer (tolerates fences or stray prose). */
export function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    // Fall back to the outermost {...} or [...] block.
    const start = candidate.search(/[[{]/);
    const open = candidate[start];
    const end = candidate.lastIndexOf(open === "[" ? "]" : "}");
    if (start === -1 || end <= start) throw new Error("No JSON found in response");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}
