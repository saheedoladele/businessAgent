import { z } from "zod";
import { askJSON, MODEL_FAST } from "@/lib/ai";
import { db, logActivity } from "@/lib/db";
import { fetchRecentEmails, imapConfigured } from "@/lib/inbox";
import {
  bouncedRecipients,
  matchLeadId,
  quickClassify,
  stripQuoted,
  type InboundEmail,
  type ReplyCategory,
} from "@/lib/reply-rules";
import { writeReply } from "./reply";
import { suppress, unsubscribeLead } from "./suppress";

/**
 * Inbox monitor: pulls recent emails, matches replies to leads, classifies
 * them and takes the next step (booking link, answer, stop, pause...).
 * Safe to run repeatedly: emails already stored are skipped.
 */

const ClassifySchema = z.object({
  category: z.enum(["INTERESTED", "QUESTION", "NOT_INTERESTED", "UNSUBSCRIBE", "OUT_OF_OFFICE", "WRONG_PERSON", "OTHER"]),
  summary: z.string(),
  returnDate: z.string().nullable().optional(),
  referral: z.string().nullable().optional(),
});

const DAY = 24 * 60 * 60 * 1000;

async function classify(text: string, subject: string) {
  return askJSON(
    ClassifySchema,
    `Classify this reply to a B2B cold email.

Categories:
- INTERESTED: wants to talk, asks for a call/meeting/times, says yes or "tell me more"
- QUESTION: asks something (price, how it works, examples) without clearly agreeing to a call
- NOT_INTERESTED: declines, already has a provider, no budget, not now
- UNSUBSCRIBE: asks not to be emailed again
- OUT_OF_OFFICE: automatic away message
- WRONG_PERSON: says they're not the right contact (maybe names who is)
- OTHER: anything else

Subject: ${subject}
Reply:
"""
${text.slice(0, 3000)}
"""`,
    {
      model: MODEL_FAST,
      temperature: 0,
      maxTokens: 400,
      shapeHint: `{ "category": "...", "summary": "one line", "returnDate": "YYYY-MM-DD or null (out of office only)", "referral": "email or name of the right person, or null" }`,
    },
  );
}

export async function processInbox(): Promise<{ checked: number; matched: number }> {
  if (!imapConfigured()) return { checked: 0, matched: 0 };
  const emails = await fetchRecentEmails();
  if (!emails.length) return { checked: 0, matched: 0 };

  // Skip emails we've already processed and our own outgoing copies.
  const seen = new Set(
    (await db.message.findMany({ where: { messageId: { in: emails.map((e) => e.messageId) } }, select: { messageId: true } }))
      .map((m) => m.messageId),
  );
  const ourAddresses = new Set(
    (await db.business.findMany({ select: { senderEmail: true } })).map((b) => b.senderEmail.toLowerCase()),
  );
  const fresh = emails.filter((e) => !seen.has(e.messageId) && !ourAddresses.has(e.fromEmail));
  if (!fresh.length) return { checked: emails.length, matched: 0 };

  // Lookup tables for matching replies to leads.
  const refIds = [...new Set(fresh.flatMap((e) => [e.inReplyTo, ...e.references]).filter(Boolean) as string[])];
  const sent = await db.message.findMany({
    where: { direction: "OUTBOUND", messageId: { in: refIds } },
    select: { messageId: true, leadId: true },
  });
  const bySentId = new Map<string, string>(sent.map((m) => [m.messageId!, m.leadId]));
  const addresses = [...new Set(fresh.flatMap((e) => [e.fromEmail, ...bouncedRecipients(e)]))];
  const leads = await db.lead.findMany({ where: { email: { in: addresses } }, select: { id: true, email: true } });
  const byEmail = new Map<string, string>(leads.map((l) => [l.email!, l.id]));

  let matched = 0;
  for (const email of fresh) {
    const leadId = matchLeadId(email, bySentId, byEmail);
    if (!leadId) continue;
    matched++;
    try {
      await handleReply(leadId, email);
    } catch (err) {
      console.error(`Inbox: failed on ${email.messageId}: ${(err as Error).message}`);
    }
  }
  return { checked: emails.length, matched };
}

async function handleReply(leadId: string, email: InboundEmail) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { business: true } });
  const b = lead.business;
  const body = stripQuoted(email.text) || email.text.slice(0, 2000);

  let category: ReplyCategory | null = quickClassify(email);
  let summary = "";
  let returnDate: string | null | undefined;
  let referral: string | null | undefined;
  if (!category) {
    const c = await classify(body, email.subject);
    ({ category, summary, returnDate, referral } = c);
  }

  // Store the inbound email (unique messageId makes this idempotent).
  await db.message.create({
    data: {
      leadId,
      direction: "INBOUND",
      channel: "EMAIL",
      status: "RECEIVED",
      subject: email.subject,
      body,
      messageId: email.messageId,
      inReplyTo: email.inReplyTo ?? null,
      classification: category,
    },
  });
  const note = (text: string) => [lead.notes, text].filter(Boolean).join("\n");
  const log = (detail: string) => logActivity(b.id, `reply.${category!.toLowerCase()}`, detail, leadId);

  switch (category) {
    case "BOUNCE": {
      if (lead.email) await suppress(lead.email, "bounce notice");
      await db.lead.update({ where: { id: leadId }, data: { status: "BOUNCED", nextActionAt: null } });
      await log(`${lead.email} bounced`);
      break;
    }
    case "UNSUBSCRIBE": {
      await unsubscribeLead(leadId, "asked by reply");
      break;
    }
    case "OUT_OF_OFFICE": {
      // Pause the sequence until they're back (or 5 days if no date given).
      const back = returnDate ? new Date(returnDate) : null;
      const resume = back && !isNaN(back.getTime()) && back > new Date() ? new Date(back.getTime() + DAY) : new Date(Date.now() + 5 * DAY);
      if (lead.status === "CONTACTED") {
        await db.lead.update({ where: { id: leadId }, data: { nextActionAt: resume } });
      }
      await log(`${lead.companyName} is out of office; follow-ups resume ${resume.toDateString()}`);
      break;
    }
    case "NOT_INTERESTED": {
      await db.lead.update({
        where: { id: leadId },
        data: { status: "NOT_INTERESTED", nextActionAt: null, notes: note(`Declined: ${summary}`) },
      });
      await log(`${lead.companyName} not interested: ${summary}`);
      break;
    }
    case "INTERESTED": {
      await db.lead.update({ where: { id: leadId }, data: { status: "INTERESTED", nextActionAt: null } });
      const reply = await writeReply(leadId, "BOOKING");
      await db.message.create({
        data: {
          leadId,
          direction: "OUTBOUND",
          channel: "EMAIL",
          status: b.requireApproval ? "DRAFT" : "APPROVED",
          step: null,
          ...reply,
        },
      });
      await log(`🎯 ${lead.companyName} is interested: ${summary || "positive reply"}. Booking reply ${b.requireApproval ? "drafted for approval" : "queued"}`);
      break;
    }
    case "QUESTION": {
      // Answers always wait for you: Claude shouldn't improvise pricing or promises.
      await db.lead.update({ where: { id: leadId }, data: { status: "REPLIED", nextActionAt: null } });
      const reply = await writeReply(leadId, "ANSWER");
      await db.message.create({
        data: { leadId, direction: "OUTBOUND", channel: "EMAIL", status: "DRAFT", step: null, ...reply },
      });
      await log(`${lead.companyName} asked a question: ${summary}. Draft answer ready for review`);
      break;
    }
    case "WRONG_PERSON": {
      await db.lead.update({
        where: { id: leadId },
        data: { status: "REPLIED", nextActionAt: null, notes: note(`Wrong contact. Referral: ${referral ?? "none given"}`) },
      });
      await log(`${lead.companyName}: wrong person${referral ? `, suggested ${referral}` : ""}`);
      break;
    }
    default: {
      await db.lead.update({ where: { id: leadId }, data: { status: "REPLIED", nextActionAt: null } });
      await log(`${lead.companyName} replied: ${summary || email.subject}`);
    }
  }
}
