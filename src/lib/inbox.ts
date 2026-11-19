import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { InboundEmail } from "./reply-rules";

/**
 * Reads recent emails from the sender mailbox over IMAP. The mailbox is
 * opened read-only, so nothing in your inbox is marked read or moved.
 */

export function imapConfigured(): boolean {
  return !!(process.env.IMAP_HOST && (process.env.IMAP_USER || process.env.SMTP_USER));
}

export async function fetchRecentEmails(sinceDays = 3, mailbox = "INBOX"): Promise<InboundEmail[]> {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST!,
    port: Number(process.env.IMAP_PORT || 993),
    secure: (process.env.IMAP_SECURE ?? "true") === "true",
    auth: {
      user: process.env.IMAP_USER || process.env.SMTP_USER!,
      pass: process.env.IMAP_PASS || process.env.SMTP_PASS!,
    },
    logger: false,
  });

  const emails: InboundEmail[] = [];
  await client.connect();
  const lock = await client.getMailboxLock(mailbox, { readOnly: true });
  try {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const uids = await client.search({ since }, { uid: true });
    if (!uids || !uids.length) return emails;

    for await (const msg of client.fetch(uids, { uid: true, source: true }, { uid: true })) {
      if (!msg.source) continue;
      const parsed = await simpleParser(msg.source);
      const fromEmail = parsed.from?.value?.[0]?.address?.toLowerCase();
      if (!parsed.messageId || !fromEmail) continue;

      const headers: Record<string, string> = {};
      for (const [k, v] of parsed.headers) {
        headers[k.toLowerCase()] = typeof v === "string" ? v : JSON.stringify(v);
      }
      const refs = parsed.references;
      emails.push({
        messageId: parsed.messageId,
        inReplyTo: parsed.inReplyTo ?? null,
        references: Array.isArray(refs) ? refs : refs ? refs.split(/\s+/) : [],
        fromEmail,
        subject: parsed.subject ?? "",
        text: parsed.text ?? "",
        headers,
        contentType: headers["content-type"],
      });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }
  return emails;
}
