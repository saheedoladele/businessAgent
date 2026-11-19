import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP transport (Gmail / Google Workspace, Zoho, Outlook, any host).
 * Plain-text only: cold emails without HTML/tracking pixels land in the
 * inbox more often and look like a real person wrote them.
 */

let _transport: Transporter | undefined;

export function transport(): Transporter {
  if (_transport) return _transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP_HOST, SMTP_USER and SMTP_PASS must be set in .env");
  }
  const port = Number(SMTP_PORT ?? 587);
  _transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: SMTP_SECURE ? SMTP_SECURE === "true" : port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return _transport;
}

export interface OutgoingEmail {
  from: { name: string; address: string };
  to: string;
  subject: string;
  text: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  unsubscribeUrl: string;
  unsubscribeMailto?: string;
}

export async function sendEmail(mail: OutgoingEmail) {
  return transport().sendMail({
    from: mail.from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    messageId: mail.messageId,
    inReplyTo: mail.inReplyTo,
    references: mail.references,
    // One-click unsubscribe (RFC 8058): required by Gmail/Yahoo for bulk senders.
    list: {
      unsubscribe: [
        { url: mail.unsubscribeUrl, comment: "Unsubscribe" },
        ...(mail.unsubscribeMailto ? [mail.unsubscribeMailto] : []),
      ],
    },
    headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
}

/** SMTP codes that mean the address is permanently bad. */
export function isHardBounce(err: unknown): boolean {
  const e = err as { responseCode?: number; response?: string };
  if (e?.responseCode && e.responseCode >= 550 && e.responseCode <= 553) return true;
  return /user unknown|no such user|mailbox (unavailable|not found)|does not exist|recipient.*rejected/i.test(
    e?.response ?? "",
  );
}
