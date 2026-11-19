import { z } from "zod";
import { askJSON } from "@/lib/ai";
import { db, logActivity } from "@/lib/db";
import { lintEmail } from "@/lib/email-lint";

/**
 * Email writer: Claude drafts a short, personalised cold email for step 0
 * and a fresh-angle follow-up for each later step. Sending, the unsubscribe
 * footer and scheduling are handled elsewhere.
 */

const EmailSchema = z.object({
  subject: z.string().min(2).max(120),
  body: z.string().min(20),
});

/** What each step of the sequence should do, so follow-ups never just "bump". */
const STEP_BRIEF = [
  "First touch. Open with something specific about THEIR business (from the research), connect it to one problem we solve, end with a low-effort question. No pitch deck energy.",
  "Follow-up 1. Offer one concrete, useful idea or quick win for their business they could act on even without us. End by asking if it's worth a short chat.",
  "Follow-up 2. Explain briefly how we'd approach their specific problem (a 2-3 step outline). Do NOT invent clients, results or case studies.",
  "Final follow-up (breakup). Short and polite: assume the timing is wrong, say you won't keep emailing, leave the door open. Include the booking link if one is provided.",
];

const MAX_WORDS = [130, 90, 110, 70];

const SYSTEM = `You write B2B cold emails that busy owners actually reply to.
Style: plain text, conversational, specific, no hype. Short paragraphs (1-3 sentences).
Never: fake familiarity ("hope you're well", "I came across your amazing company"), invented facts,
invented clients or results, placeholders like [Name], emojis, ALL CAPS, more than one call to action,
or spam words (free, guarantee, act now, limited time, 100%).
If you don't know the person's name, open with "Hi there," or "Hi {Company} team,".
Sign off with the sender's first name only. Do not add an unsubscribe line or address (added automatically).`;

export interface DraftEmail {
  subject: string;
  body: string;
}

export async function writeEmail(leadId: string, step: number): Promise<DraftEmail> {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: {
      business: true,
      messages: { where: { channel: "EMAIL" }, orderBy: { createdAt: "asc" } },
    },
  });
  const b = lead.business;
  const brief = STEP_BRIEF[Math.min(step, STEP_BRIEF.length - 1)];
  const maxWords = MAX_WORDS[Math.min(step, MAX_WORDS.length - 1)];

  const thread = lead.messages
    .filter((m) => m.status === "SENT" || m.status === "RECEIVED")
    .map((m) => `--- ${m.direction === "OUTBOUND" ? "We sent" : "They replied"} ---\n${m.body}`)
    .join("\n\n");

  const prompt = `Write email step ${step} of a cold outreach sequence.

## Brief for this step
${brief}
Maximum ${maxWords} words in the body.

## Sender
${b.senderName} from ${b.name}${b.website ? ` (${b.website})` : ""}
What we do: ${b.description}
Services:
${b.services}
${b.bookingUrl ? `Booking link (only use if the brief says so): ${b.bookingUrl}` : ""}

## Recipient
Company: ${lead.companyName} (${lead.domain})
Contact: ${lead.contactName ?? "unknown name"}${lead.contactRole ? `, ${lead.contactRole}` : ""}
Location: ${lead.location ?? "unknown"}
What they do: ${lead.description ?? "unknown"}
Why they're a fit: ${lead.fitReason ?? "n/a"}
Research notes:
${lead.notes ?? "none"}

${thread ? `## Emails already sent in this thread (don't repeat their points)\n${thread}` : ""}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await askJSON(EmailSchema, prompt, {
      system: SYSTEM,
      shapeHint: `{ "subject": "short, lowercase-ish, specific, no clickbait (ignored for follow-ups)", "body": "email body" }`,
      maxTokens: 1200,
      temperature: 0.7,
    });
    const issues = lintEmail(draft.body, maxWords);
    if (!issues.length) {
      // Follow-ups stay in the same thread so the recipient sees the context.
      const first = lead.messages.find((m) => m.direction === "OUTBOUND" && m.step === 0);
      const subject = step > 0 && first?.subject ? `Re: ${first.subject.replace(/^re:\s*/i, "")}` : draft.subject;
      return { subject, body: draft.body.trim() };
    }
    if (attempt === 1) throw new Error(`Draft failed quality checks: ${issues.join("; ")}`);
  }
  throw new Error("unreachable");
}

/**
 * Draft the first email for a QUALIFIED lead. If the business requires
 * approval it waits as a DRAFT (lead → PENDING_APPROVAL); otherwise it is
 * APPROVED and the sender picks it up.
 */
export async function draftFirstEmail(leadId: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { business: true } });
  if (lead.status !== "QUALIFIED") throw new Error(`Lead is ${lead.status}, expected QUALIFIED`);

  const existing = await db.message.findFirst({
    where: { leadId, step: 0, direction: "OUTBOUND", status: { in: ["DRAFT", "APPROVED"] } },
  });
  if (existing) return existing;

  const draft = await writeEmail(leadId, 0);
  const needsApproval = lead.business.requireApproval;

  const message = await db.message.create({
    data: {
      leadId,
      direction: "OUTBOUND",
      channel: "EMAIL",
      status: needsApproval ? "DRAFT" : "APPROVED",
      step: 0,
      subject: draft.subject,
      body: draft.body,
    },
  });
  await db.lead.update({
    where: { id: leadId },
    data: { status: needsApproval ? "PENDING_APPROVAL" : "QUALIFIED" },
  });
  await logActivity(
    lead.businessId,
    "email.drafted",
    `Drafted first email to ${lead.companyName}${needsApproval ? " (awaiting your approval)" : ""}`,
    leadId,
  );
  return message;
}

/** Approve a draft, optionally with your edits. */
export async function approveDraft(messageId: string, edits?: Partial<DraftEmail>) {
  const msg = await db.message.update({
    where: { id: messageId },
    data: { status: "APPROVED", ...(edits?.subject ? { subject: edits.subject } : {}), ...(edits?.body ? { body: edits.body } : {}) },
    include: { lead: true },
  });
  // First emails return the lead to QUALIFIED (ready to send); replies keep the lead's status.
  if (msg.step === 0) await db.lead.update({ where: { id: msg.leadId }, data: { status: "QUALIFIED" } });
  await logActivity(msg.lead.businessId, "email.approved", `Approved email to ${msg.lead.companyName}`, msg.leadId);
  return msg;
}

/** Reject a draft. For a first email this drops the lead from outreach. */
export async function rejectDraft(messageId: string, reason = "Rejected by user") {
  const msg = await db.message.delete({ where: { id: messageId }, include: { lead: true } });
  if (msg.step !== 0) {
    // Rejecting a reply/follow-up just discards it; you'll answer yourself.
    await logActivity(msg.lead.businessId, "email.rejected", `Discarded draft to ${msg.lead.companyName}`, msg.leadId);
    return;
  }
  await db.lead.update({
    where: { id: msg.leadId },
    data: { status: "DISQUALIFIED", notes: [msg.lead.notes, `Disqualified: ${reason}`].filter(Boolean).join("\n") },
  });
  await logActivity(msg.lead.businessId, "email.rejected", `Rejected email to ${msg.lead.companyName}`, msg.leadId);
}
