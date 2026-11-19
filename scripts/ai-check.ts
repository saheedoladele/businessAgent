/**
 * Check the Claude API key and model with one tiny request.
 *   npm run ai:check
 */
import { askText, MODEL, resolveApiKey } from "@/lib/ai";

async function main() {
  const key = resolveApiKey();
  console.log(`Key: ${key.slice(0, 14)}…${key.slice(-4)} (${key.length} chars)`);
  console.log(`Model: ${MODEL}`);
  if (process.env.ANTHROPIC_AUTH_TOKEN) {
    console.log("Note: ANTHROPIC_AUTH_TOKEN is also set in your environment; it is ignored.");
  }
  const reply = await askText('Reply with just the word "ok".', { maxTokens: 10 });
  console.log(`API reply: ${reply}`);
  console.log("Claude API works ✔");
}

main().catch((e) => {
  console.error(`✘ ${(e as Error).message}`);
  process.exitCode = 1;
});
