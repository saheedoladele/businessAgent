import { db, logActivity } from "@/lib/db";

/** Add an email or domain to the global do-not-contact list. */
export async function suppress(value: string, reason: string) {
  const v = value.trim().toLowerCase();
  await db.suppression.upsert({ where: { value: v }, update: {}, create: { value: v, reason } });
}

export async function isSuppressed(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  const hit = await db.suppression.findFirst({ where: { value: { in: [e, e.split("@")[1]] } } });
  return !!hit;
}

/** Opt a lead out everywhere: suppress their email and stop the sequence. */
export async function unsubscribeLead(leadId: string, reason = "unsubscribed") {
  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  if (lead.email) await suppress(lead.email, reason);
  await db.lead.update({ where: { id: leadId }, data: { status: "UNSUBSCRIBED", nextActionAt: null } });
  await db.message.updateMany({
    where: { leadId, status: { in: ["DRAFT", "APPROVED"] } },
    data: { status: "FAILED", error: "Lead unsubscribed" },
  });
  await logActivity(lead.businessId, "lead.unsubscribed", `${lead.companyName} opted out (${reason})`, leadId);
  return lead;
}
