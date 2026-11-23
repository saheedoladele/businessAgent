/**
 * Optional Hunter.io lookup (free tier available): finds published work
 * emails for a company domain. Only used when HUNTER_API_KEY is set.
 */

export interface HunterEmail {
  value: string;
  type?: "personal" | "generic" | null;
  confidence?: number | null;
  first_name?: string | null;
  last_name?: string | null;
  position?: string | null;
  verification?: { status?: string | null } | null;
}

export function hunterConfigured(): boolean {
  return !!process.env.HUNTER_API_KEY;
}

export async function hunterDomainSearch(domain: string): Promise<HunterEmail[]> {
  const url = new URL("https://api.hunter.io/v2/domain-search");
  url.searchParams.set("domain", domain);
  url.searchParams.set("limit", "10");
  url.searchParams.set("api_key", process.env.HUNTER_API_KEY!);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Hunter ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: { emails?: HunterEmail[] } };
  return json.data?.emails ?? [];
}

const DECISION_MAKER = /(founder|owner|ceo|chief|director|head|manager|principal|partner|md\b|managing)/i;

/**
 * Best Hunter result: skip low-confidence and known-invalid addresses,
 * prefer decision makers, then named people, then generic inboxes.
 */
export function pickHunterEmail(emails: HunterEmail[], minConfidence = 70): HunterEmail | null {
  const usable = emails.filter(
    (e) => (e.confidence ?? 0) >= minConfidence && !["invalid", "blocked"].includes(e.verification?.status ?? ""),
  );
  const score = (e: HunterEmail) =>
    (DECISION_MAKER.test(e.position ?? "") ? 100 : 0) + (e.type === "personal" ? 50 : 0) + (e.confidence ?? 0) / 10;
  return usable.sort((a, b) => score(b) - score(a))[0] ?? null;
}
