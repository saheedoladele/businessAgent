/** Pure follow-up sequence rules (no database, easy to test). */

export type SequenceAction = "wait" | "follow-up" | "finish" | "nudge" | "stop-nudging";

/** How many booking reminders an interested lead gets before you take over. */
export const MAX_NUDGES = 2;

/**
 * Decide what to do with a lead whose timer may be due.
 * - CONTACTED: `sequenceStep` = emails sent so far; followUpDays.length =
 *   follow-ups after the first email. Then the sequence finishes.
 * - INTERESTED (replied yes, no meeting yet): send up to MAX_NUDGES
 *   reminders with the booking link.
 */
export function nextSequenceAction(
  lead: { status: string; sequenceStep: number; nextActionAt: Date | null },
  followUpDays: number[],
  now = new Date(),
  nudgesSent = 0,
): SequenceAction {
  if (!lead.nextActionAt || lead.nextActionAt > now) return "wait";
  if (lead.status === "CONTACTED") {
    return lead.sequenceStep <= followUpDays.length ? "follow-up" : "finish";
  }
  if (lead.status === "INTERESTED") {
    return nudgesSent < MAX_NUDGES ? "nudge" : "stop-nudging";
  }
  return "wait";
}
