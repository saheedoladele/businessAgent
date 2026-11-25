import { db, logActivity } from "@/lib/db";
import { enqueue } from "@/lib/queue";
import { nextSequenceAction } from "@/lib/sequence-rules";
import { writeReply } from "./reply";
import { writeEmail } from "./write-email";

/**
 * Follow-up sequence. After each email, send.ts sets lead.nextActionAt.
 * When that time arrives for a CONTACTED lead, we either write the next
 * follow-up or close the sequence as NO_RESPONSE.
 */

/** Leads whose next step is due, across all active businesses. */
export async function dueLeads(now = new Date()) {
  return db.lead.findMany({
    where: { status: { in: ["CONTACTED", "INTERESTED"] }, nextActionAt: { lte: now }, business: { active: true } },
    select: { id: true },
    take: 200,
  });
}

/** Act on one due lead: next follow-up, end of sequence, or a booking reminder. */
export async function advanceLead(leadId: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { business: true } });
  // Booking reminders already sent = our replies after their last inbound message.
  const lastInbound = await db.message.findFirst({
    where: { leadId, direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
  });
  const nudgesSent = lastInbound
    ? await db.message.count({
        where: { leadId, direction: "OUTBOUND", step: null, status: "SENT", createdAt: { gt: lastInbound.createdAt } },
      }) - 1 // the first one is the booking reply itself
    : 0;

  const action = nextSequenceAction(lead, lead.business.followUpDays, new Date(), Math.max(0, nudgesSent));
  if (action === "wait") return action;

  if (action === "finish") {
    await db.lead.update({ where: { id: lead.id }, data: { status: "NO_RESPONSE", nextActionAt: null } });
    await logActivity(lead.businessId, "sequence.finished", `No reply from ${lead.companyName}, sequence ended`, lead.id);
    return action;
  }

  if (action === "stop-nudging") {
    await db.lead.update({ where: { id: lead.id }, data: { nextActionAt: null } });
    await logActivity(
      lead.businessId,
      "lead.needs_you",
      `${lead.companyName} was interested but hasn't booked after reminders. Worth a personal message or call.`,
      lead.id,
    );
    // A call usually closes these: queue a call task if we have a number.
    if (lead.phone) await enqueue("call-task", { leadId: lead.id, reason: "NOT_BOOKED" }, `call-${lead.id}`);
    return action;
  }

  if (action === "nudge") {
    const reply = await writeReply(leadId, "NUDGE");
    await db.message.create({
      data: { leadId, direction: "OUTBOUND", channel: "EMAIL", status: "APPROVED", step: null, ...reply },
    });
    await db.lead.update({ where: { id: lead.id }, data: { nextActionAt: null } });
    await logActivity(lead.businessId, "email.drafted", `Wrote booking reminder for ${lead.companyName}`, lead.id);
    return action;
  }

  // Follow-ups are approved automatically: you approved the first email and
  // the sequence, so we don't ask again each time.
  const step = lead.sequenceStep; // e.g. 1 email sent → write follow-up step 1
  const exists = await db.message.findFirst({ where: { leadId, step, direction: "OUTBOUND" } });
  if (!exists) {
    const draft = await writeEmail(leadId, step);
    await db.message.create({
      data: { leadId, direction: "OUTBOUND", channel: "EMAIL", status: "APPROVED", step, ...draft },
    });
    await logActivity(lead.businessId, "email.drafted", `Wrote follow-up ${step} for ${lead.companyName}`, lead.id);
  }
  // Clear so the next tick doesn't pick it up again; send.ts sets the next date.
  await db.lead.update({ where: { id: lead.id }, data: { nextActionAt: null } });
  return action;
}
