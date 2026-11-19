/** Pure follow-up sequence rules (no database, easy to test). */

export type SequenceAction = "wait" | "follow-up" | "finish";

/**
 * Pure decision (easy to test). `sequenceStep` = emails sent so far;
 * followUpDays.length = number of follow-ups after the first email.
 */
export function nextSequenceAction(
  lead: { status: string; sequenceStep: number; nextActionAt: Date | null },
  followUpDays: number[],
  now = new Date(),
): SequenceAction {
  if (lead.status !== "CONTACTED" || !lead.nextActionAt || lead.nextActionAt > now) return "wait";
  return lead.sequenceStep <= followUpDays.length ? "follow-up" : "finish";
}
