import { randomUUID } from "node:crypto";
import { db, logActivity } from "@/lib/db";
import { isHardBounce, sendEmail } from "@/lib/mailer";
import { buildFooter, unsubscribeUrl } from "@/lib/unsubscribe";
import { isSuppressed, suppress } from "./suppress";

/**
 * Sender: delivers one APPROVED outbound email, keeping it in the same
 * thread as earlier emails, and schedules the next follow-up.
 */

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "limit" | "skipped" | "bounced" | "failed"; detail: string };

/** Lead states where we must not send anything else. */
const STOP_STATUSES = new Set([
  "DISQUALIFIED", "REPLIED", "INTERESTED", "MEETING_SCHEDULED",
  "NOT_INTERESTED", "UNSUBSCRIBED", "BOUNCED", "NO_RESPONSE",
]);

const DAY = 24 * 60 * 60 * 1000;

/** How many emails this business has sent since midnight (UTC). */
export async function sentToday(businessId: string): Promise<number> {
  const midnight = new Date();
  midnight.setUTCHours(0, 0, 0, 0);
  return db.message.count({
    where: { direction: "OUTBOUND", status: "SENT", sentAt: { gte: midnight }, lead: { businessId } },
  });
}

export async function sendMessage(messageId: string): Promise<SendResult> {
  const msg = await db.message.findUniqueOrThrow({
    where: { id: messageId },
    include: { lead: { include: { business: true } } },
  });
  const { lead } = msg;
  const b = lead.business;

  const skip = async (detail: string): Promise<SendResult> => {
    await db.message.update({ where: { id: msg.id }, data: { status: "FAILED", error: `Skipped: ${detail}` } });
    return { ok: false, reason: "skipped", detail };
  };

  if (msg.status !== "APPROVED") return { ok: false, reason: "skipped", detail: `message is ${msg.status}` };
  if (STOP_STATUSES.has(lead.status)) return skip(`lead is ${lead.status}`);
  if (!lead.email) return skip("lead has no email");
  if (await isSuppressed(lead.email)) return skip("email is on the do-not-contact list");
  if ((await sentToday(b.id)) >= b.dailySendLimit) {
    return { ok: false, reason: "limit", detail: `daily limit of ${b.dailySendLimit} reached` };
  }

  // Thread with everything already exchanged so replies and follow-ups group together.
  const previous = await db.message.findMany({
    where: { leadId: lead.id, messageId: { not: null }, id: { not: msg.id } },
    orderBy: { createdAt: "asc" },
    select: { messageId: true },
  });
  const references = previous.map((p) => p.messageId!);
  const senderDomain = b.senderEmail.split("@")[1];
  const newMessageId = `<${randomUUID()}@${senderDomain}>`;
  const unsubUrl = unsubscribeUrl(lead.id);

  try {
    await sendEmail({
      from: { name: b.senderName, address: b.senderEmail },
      to: lead.contactName ? `"${lead.contactName.replace(/"/g, "")}" <${lead.email}>` : lead.email,
      subject: msg.subject ?? `Quick question for ${lead.companyName}`,
      text: msg.body + "\n" + buildFooter({ businessName: b.name, physicalAddress: b.physicalAddress, unsubscribeUrl: unsubUrl }),
      messageId: newMessageId,
      inReplyTo: references.at(-1),
      references,
      unsubscribeUrl: unsubUrl,
      unsubscribeMailto: `mailto:${b.senderEmail}?subject=unsubscribe`,
    });
  } catch (err) {
    const detail = (err as Error).message;
    if (isHardBounce(err)) {
      await suppress(lead.email, "hard bounce");
      await db.message.update({ where: { id: msg.id }, data: { status: "FAILED", error: detail } });
      await db.lead.update({ where: { id: lead.id }, data: { status: "BOUNCED", nextActionAt: null } });
      await logActivity(b.id, "email.bounced", `${lead.email} bounced: ${detail}`, lead.id);
      return { ok: false, reason: "bounced", detail };
    }
    // Temporary problem (network, rate limit): keep it APPROVED so it retries later.
    await db.message.update({ where: { id: msg.id }, data: { error: detail } });
    return { ok: false, reason: "failed", detail };
  }

  const step = msg.step ?? 0;
  const now = new Date();
  // Wait N days before the next step; after the last step, wait 7 days for a late reply.
  const waitDays = b.followUpDays[step] ?? 7;

  await db.message.update({
    where: { id: msg.id },
    data: { status: "SENT", sentAt: now, messageId: newMessageId, error: null },
  });
  await db.lead.update({
    where: { id: lead.id },
    data: {
      status: "CONTACTED",
      sequenceStep: step + 1,
      lastContactedAt: now,
      nextActionAt: new Date(now.getTime() + waitDays * DAY),
    },
  });
  await logActivity(
    b.id,
    "email.sent",
    `Sent ${step === 0 ? "first email" : `follow-up ${step}`} to ${lead.companyName} <${lead.email}>`,
    lead.id,
  );
  return { ok: true };
}

/** Send every approved email for a business, oldest first, until the daily limit. */
export async function sendApproved(businessId: string) {
  const queue = await db.message.findMany({
    where: { status: "APPROVED", direction: "OUTBOUND", channel: "EMAIL", lead: { businessId } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const results: SendResult[] = [];
  for (const m of queue) {
    const r = await sendMessage(m.id);
    results.push(r);
    if (!r.ok && r.reason === "limit") break;
  }
  return results;
}
