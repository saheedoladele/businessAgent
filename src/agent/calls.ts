import { z } from "zod";
import { askJSON } from "@/lib/ai";
import { planAfterCall, type CallOutcome } from "@/lib/call-rules";
import { db, logActivity } from "@/lib/db";
import { toE164 } from "@/lib/phone";
import { voiceProvider } from "@/lib/voice";

/**
 * Phone channel. The agent prepares call tasks (who, why, a short script
 * and a ready-to-send WhatsApp message); you make the call and record the
 * outcome, and the lead moves on accordingly. With VOICE_PROVIDER=vapi,
 * tasks for leads who already said yes can be called by an AI instead.
 */

const ScriptSchema = z.object({
  script: z.string().min(50),
  whatsapp: z.string().min(10),
});

const DAY = 24 * 60 * 60 * 1000;

async function writeCallScript(leadId: string, reason: "NO_EMAIL" | "NOT_BOOKED" | "MANUAL") {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true, messages: { orderBy: { createdAt: "asc" }, take: 10 } },
  });
  const b = lead.business;
  const history = lead.messages
    .filter((m) => m.status === "SENT" || m.status === "RECEIVED")
    .map((m) => `${m.direction === "OUTBOUND" ? "We" : "They"}: ${m.body.slice(0, 400)}`)
    .join("\n");

  const situation =
    reason === "NOT_BOOKED"
      ? "They replied positively by email but haven't booked a meeting despite reminders. Friendly check-in; goal is to book a time on the call."
      : reason === "NO_EMAIL"
        ? "First contact. We only have their phone number. Permission-based opener: ask if it's a good time, keep it under 30 seconds before asking a question."
        : "Follow-up call requested by the seller.";

  return askJSON(
    ScriptSchema,
    `Write a short phone call script and a WhatsApp message for the seller.

## Situation
${situation}

## Seller
${b.senderName} from ${b.name}. ${b.description}
Services:
${b.services}
Booking link: ${b.bookingUrl ?? "(none, offer to send a calendar invite)"}

## Prospect
${lead.companyName}${lead.contactName ? `, ${lead.contactName}${lead.contactRole ? ` (${lead.contactRole})` : ""}` : ""}
What they do: ${lead.description ?? "unknown"}
Why they're a fit: ${lead.fitReason ?? "n/a"}
Research notes: ${lead.notes ?? "none"}
${history ? `\n## Email history\n${history}` : ""}

## Format
"script": plain text with these labelled parts: OPENER, REASON FOR CALLING (one specific observation about them),
2 QUESTIONS, IF THEY'RE BUSY, COMMON OBJECTIONS (2, with short answers), CLOSE (ask for a 20-minute meeting), VOICEMAIL (under 20 seconds).
"whatsapp": a short, friendly WhatsApp message (under 60 words) the seller can send if the call isn't answered, including the booking link if there is one.
Never invent clients, results or prices.`,
    { maxTokens: 1500, temperature: 0.6, shapeHint: `{ "script": "...", "whatsapp": "..." }` },
  );
}

/** Create a call task unless the lead already has an open one. */
export async function createCallTask(leadId: string, reason: "NO_EMAIL" | "NOT_BOOKED" | "MANUAL") {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  const phone = lead.phone ? toE164(lead.phone) : null;
  if (!phone) return null;

  const open = await db.callTask.findFirst({ where: { leadId, status: { in: ["OPEN", "CALLING"] } } });
  if (open) return open;

  const { script, whatsapp } = await writeCallScript(leadId, reason);
  const task = await db.callTask.create({
    data: { leadId, reason, phone, script, whatsappText: whatsapp },
  });
  await logActivity(lead.businessId, "call.task", `☎ Call ${lead.companyName} on ${phone} (${reason.toLowerCase().replace("_", " ")})`, leadId);

  // AI calling is only allowed for people who already said yes by email.
  const provider = await voiceProvider().catch(() => null);
  if (provider?.automatic && reason === "NOT_BOOKED") {
    await placeAiCall(task.id).catch((e) => console.error(`AI call failed: ${(e as Error).message}`));
  }
  return task;
}

async function placeAiCall(taskId: string) {
  const task = await db.callTask.findUniqueOrThrow({ where: { id: taskId }, include: { lead: { include: { business: true } } } });
  const { lead } = task;
  const provider = await voiceProvider();
  const { callId } = await provider.startCall({
    to: task.phone,
    script: task.script,
    variables: {
      company: lead.companyName,
      contactName: lead.contactName ?? "",
      sellerName: lead.business.senderName,
      sellerCompany: lead.business.name,
      bookingUrl: lead.business.bookingUrl ?? "",
    },
    metadata: { callTaskId: task.id, leadId: lead.id },
  });
  await db.callTask.update({
    where: { id: task.id },
    data: { status: "CALLING", provider: provider.name, externalCallId: callId },
  });
}

/** Record what happened on a call and move the lead on. */
export async function completeCallTask(taskId: string, outcome: CallOutcome, notes?: string) {
  const task = await db.callTask.findUniqueOrThrow({ where: { id: taskId }, include: { lead: true } });
  const { lead } = task;
  const plan = planAfterCall(outcome, task.attempts);
  const now = new Date();

  await db.callTask.update({
    where: { id: task.id },
    data: {
      status: plan.taskStatus,
      outcome,
      notes: [task.notes, notes].filter(Boolean).join("\n") || null,
      attempts: { increment: 1 },
      ...(plan.retryInDays ? { dueAt: new Date(now.getTime() + plan.retryInDays * DAY) } : {}),
      ...(plan.taskStatus !== "OPEN" ? { completedAt: now } : {}),
    },
  });

  // Keep a record of the call in the lead's conversation history.
  await db.message.create({
    data: {
      leadId: lead.id,
      direction: "OUTBOUND",
      channel: "PHONE",
      status: "SENT",
      body: `Call outcome: ${outcome}${notes ? `\n${notes}` : ""}`,
      classification: outcome,
      sentAt: now,
    },
  });

  if (plan.leadStatus) {
    await db.lead.update({
      where: { id: lead.id },
      data: { status: plan.leadStatus, nextActionAt: null, lastContactedAt: now },
    });
    if (plan.leadStatus === "MEETING_SCHEDULED" || plan.leadStatus === "NOT_INTERESTED" || plan.leadStatus === "DISQUALIFIED") {
      await db.message.updateMany({
        where: { leadId: lead.id, direction: "OUTBOUND", status: { in: ["DRAFT", "APPROVED"] } },
        data: { status: "FAILED", error: `Cancelled: call outcome ${outcome}` },
      });
    }
  }
  await logActivity(lead.businessId, "call.done", `☎ ${lead.companyName}: ${outcome}${notes ? ` (${notes})` : ""}`, lead.id);
}
