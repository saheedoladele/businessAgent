import { db, logActivity } from "@/lib/db";
import type { BookingEvent } from "@/lib/booking";

/**
 * Closes the loop: a booking on Cal.com/Calendly marks the lead as
 * MEETING_SCHEDULED and stops every pending email to them. A cancellation
 * puts them back to INTERESTED so the agent nudges them to rebook.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Find the lead: exact email first, otherwise a colleague at the same company domain. */
async function findLead(email: string) {
  const exact = await db.lead.findFirst({ where: { email }, orderBy: { updatedAt: "desc" } });
  if (exact) return exact;
  const domain = email.split("@")[1];
  if (!domain || /^(gmail|yahoo|outlook|hotmail|icloud|aol|proton(mail)?)\./.test(domain)) return null;
  return db.lead.findFirst({ where: { domain }, orderBy: { updatedAt: "desc" } });
}

export async function recordBooking(ev: BookingEvent): Promise<{ matched: boolean; leadId?: string }> {
  if (ev.kind === "ignored") return { matched: false };
  const lead = await findLead(ev.attendeeEmail);
  if (!lead) return { matched: false };

  if (ev.kind === "created") {
    await db.meeting.upsert({
      where: { externalId: ev.externalId },
      update: { startsAt: ev.startsAt, endsAt: ev.endsAt ?? null, joinUrl: ev.joinUrl ?? null, cancelledAt: null },
      create: {
        leadId: lead.id,
        provider: ev.provider,
        externalId: ev.externalId,
        startsAt: ev.startsAt,
        endsAt: ev.endsAt ?? null,
        attendeeEmail: ev.attendeeEmail,
        joinUrl: ev.joinUrl ?? null,
      },
    });
    await db.lead.update({ where: { id: lead.id }, data: { status: "MEETING_SCHEDULED", nextActionAt: null } });
    // Nothing else should go out automatically: follow-ups and reminders are now pointless.
    await db.message.updateMany({
      where: { leadId: lead.id, direction: "OUTBOUND", status: { in: ["DRAFT", "APPROVED"] } },
      data: { status: "FAILED", error: "Cancelled: meeting booked" },
    });
    await logActivity(
      lead.businessId,
      "meeting.booked",
      `📅 ${lead.companyName} booked a meeting for ${ev.startsAt.toUTCString()}${ev.attendeeName ? ` with ${ev.attendeeName}` : ""}`,
      lead.id,
    );
    return { matched: true, leadId: lead.id };
  }

  // Cancelled
  await db.meeting.updateMany({ where: { externalId: ev.externalId }, data: { cancelledAt: new Date() } });
  const stillBooked = await db.meeting.count({
    where: { leadId: lead.id, cancelledAt: null, startsAt: { gt: new Date() } },
  });
  if (!stillBooked && lead.status === "MEETING_SCHEDULED") {
    await db.lead.update({
      where: { id: lead.id },
      data: { status: "INTERESTED", nextActionAt: new Date(Date.now() + DAY) }, // remind them to rebook tomorrow
    });
  }
  await logActivity(lead.businessId, "meeting.cancelled", `${lead.companyName} cancelled their meeting`, lead.id);
  return { matched: true, leadId: lead.id };
}
