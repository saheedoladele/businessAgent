import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed unsubscribe tokens: "<leadId>.<signature>". The signature stops
 * anyone from unsubscribing other people by guessing IDs.
 */

function secret(): string {
  const s = process.env.UNSUBSCRIBE_SECRET;
  if (!s || s.length < 16) throw new Error("UNSUBSCRIBE_SECRET must be set (16+ characters)");
  return s;
}

function sign(leadId: string, key: string): string {
  return createHmac("sha256", key).update(leadId).digest("base64url").slice(0, 32);
}

export function createUnsubscribeToken(leadId: string, key = secret()): string {
  return `${leadId}.${sign(leadId, key)}`;
}

/** Returns the leadId if the token is genuine, otherwise null. */
export function verifyUnsubscribeToken(token: string, key = secret()): string | null {
  const [leadId, sig] = token.split(".");
  if (!leadId || !sig) return null;
  const expected = Buffer.from(sign(leadId, key));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? leadId : null;
}

export function unsubscribeUrl(leadId: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/unsubscribe?token=${encodeURIComponent(createUnsubscribeToken(leadId))}`;
}

/** Plain-text footer required for cold email (opt-out + sender's postal address). */
export function buildFooter(opts: { businessName: string; physicalAddress?: string | null; unsubscribeUrl: string }): string {
  return [
    "",
    "--",
    `${opts.businessName}${opts.physicalAddress ? `, ${opts.physicalAddress}` : ""}`,
    `Not relevant? Reply "stop" or unsubscribe: ${opts.unsubscribeUrl}`,
  ].join("\n");
}
