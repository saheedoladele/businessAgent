import { db, logActivity } from "@/lib/db";
import { nextSequenceAction } from "@/lib/sequence-rules";
import { writeEmail } from "./write-email";

/**
 * Follow-up sequence. After each email, send.ts sets lead.nextActionAt.
 * When that time arrives for a CONTACTED lead, we either write the next
 * follow-up or close the sequence as NO_RESPONSE.
 */

/** Leads whose next step is due, across all active businesses. */
export async function dueLeads(now = new Date()) {
  return db.lead.findMany({
    where: { status: "CONTACTED", nextActionAt: { lte: now }, business: { active: true } },
    select: { id: true },
    take: 200,
  });
}

/**
 * Act on one due lead. Follow-ups are approved automatically: you approved
 * the first email and the sequence, so we don't ask again each time.
 */
export async function advanceLead(leadId: string) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { business: true } });
  const action = nextSequenceAction(lead, lead.business.followUpDays);
  if (action === "wait") return action;

  if (action === "finish") {
    await db.lead.update({ where: { id: lead.id }, data: { status: "NO_RESPONSE", nextActionAt: null } });
    await logActivity(lead.businessId, "sequence.finished", `No reply from ${lead.companyName}, sequence ended`, lead.id);
    return action;
  }

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
