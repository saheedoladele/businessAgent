/**
 * Pure rules for inbound email (no database or network, easy to test):
 * spotting auto-replies and bounces, trimming quoted history, cheap
 * keyword classification, and matching a reply to the email it answers.
 */

export interface InboundEmail {
  messageId: string;
  inReplyTo?: string | null;
  references: string[];
  fromEmail: string;
  subject: string;
  text: string; // plain-text body
  headers: Record<string, string>; // lowercase header name -> value
  contentType?: string;
}

export type ReplyCategory =
  | "INTERESTED" // wants to talk / asks for a call or times
  | "QUESTION" // asks something (price, details) before deciding
  | "NOT_INTERESTED"
  | "UNSUBSCRIBE" // asks not to be contacted
  | "OUT_OF_OFFICE"
  | "WRONG_PERSON" // points to someone else
  | "BOUNCE"
  | "OTHER";

/** Automatic replies (vacation responders, ticket systems) per RFC 3834 and common headers. */
export function isAutoReply(email: InboundEmail): boolean {
  const h = email.headers;
  if (h["auto-submitted"] && h["auto-submitted"].toLowerCase() !== "no") return true;
  if (h["x-autoreply"] || h["x-autorespond"] || h["x-auto-response-suppress"]) return true;
  if (/^(auto|bulk)/i.test(h["precedence"] ?? "")) return true;
  return /^(auto(matic)?[ -]?reply|out of (the )?office|ooo\b|away from)/i.test(email.subject);
}

/** Delivery failure notices from mail servers. */
export function isBounce(email: InboundEmail): boolean {
  if (/^(mailer-daemon|postmaster)@/i.test(email.fromEmail)) return true;
  if (/multipart\/report.*delivery-status/i.test(email.contentType ?? "")) return true;
  return /(undeliver|delivery (status notification|has failed|failure)|returned mail|mail delivery failed)/i.test(
    email.subject,
  );
}

/** Addresses mentioned in a bounce (DSN recipient fields first, then any in the text). */
export function bouncedRecipients(email: InboundEmail): string[] {
  const found: string[] = [];
  for (const m of email.text.matchAll(/(?:final|original)-recipient:\s*(?:rfc822;)?\s*<?([^\s<>;]+@[^\s<>;]+)>?/gi)) {
    found.push(m[1].toLowerCase());
  }
  for (const m of email.text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) found.push(m[0].toLowerCase());
  return [...new Set(found)];
}

/** Keep only what the person wrote, not the quoted thread below it. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .{5,200}wrote:\s*$/.test(line.trim())) break; // Gmail/Apple style
    if (/^-{2,}\s*Original Message\s*-{2,}/i.test(line.trim())) break; // Outlook
    if (/^From:\s.+/.test(line.trim()) && out.length > 0) break; // Outlook header block
    if (/^__{5,}/.test(line.trim())) break;
    if (line.startsWith(">")) continue;
    out.push(line);
  }
  return out.join("\n").trim();
}

/**
 * Cheap classification for obvious cases so we don't spend an AI call.
 * Returns null when Claude should decide.
 */
export function quickClassify(email: InboundEmail): ReplyCategory | null {
  if (isBounce(email)) return "BOUNCE";
  if (isAutoReply(email)) return "OUT_OF_OFFICE";
  const body = stripQuoted(email.text).toLowerCase().replace(/[^a-z\s]/g, " ").trim();
  if (/^(stop|unsubscribe|remove( me)?|remove me from your list|please remove me|opt out)$/.test(body)) {
    return "UNSUBSCRIBE";
  }
  return null;
}

/**
 * Find which of our sent emails this one replies to. Tries In-Reply-To,
 * then References (newest first), then falls back to the sender's address.
 */
export function matchLeadId(
  email: InboundEmail,
  leadIdBySentMessageId: Map<string, string>,
  leadIdByEmail: Map<string, string>,
): string | null {
  const ids = [email.inReplyTo, ...[...email.references].reverse()].filter(Boolean) as string[];
  for (const id of ids) {
    const hit = leadIdBySentMessageId.get(id.trim());
    if (hit) return hit;
  }
  if (isBounce(email)) {
    for (const rcpt of bouncedRecipients(email)) {
      if (leadIdByEmail.has(rcpt)) return leadIdByEmail.get(rcpt)!;
    }
  }
  return leadIdByEmail.get(email.fromEmail.toLowerCase()) ?? null;
}
