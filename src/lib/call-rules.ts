/** Pure rules for what happens after a call (no database, easy to test). */

export const CALL_OUTCOMES = ["BOOKED", "INTERESTED", "CALLBACK", "NOT_INTERESTED", "NO_ANSWER", "WRONG_NUMBER"] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const MAX_CALL_ATTEMPTS = 3;

export interface CallPlan {
  taskStatus: "OPEN" | "DONE" | "SKIPPED";
  retryInDays?: number; // reschedule the same task
  leadStatus?: "MEETING_SCHEDULED" | "INTERESTED" | "NOT_INTERESTED" | "DISQUALIFIED" | "NO_RESPONSE";
}

export function planAfterCall(outcome: CallOutcome, attemptsSoFar: number): CallPlan {
  switch (outcome) {
    case "BOOKED":
      return { taskStatus: "DONE", leadStatus: "MEETING_SCHEDULED" };
    case "INTERESTED":
      return { taskStatus: "DONE", leadStatus: "INTERESTED" };
    case "CALLBACK":
      return { taskStatus: "OPEN", retryInDays: 2 };
    case "NOT_INTERESTED":
      return { taskStatus: "DONE", leadStatus: "NOT_INTERESTED" };
    case "WRONG_NUMBER":
      return { taskStatus: "DONE", leadStatus: "DISQUALIFIED" };
    case "NO_ANSWER":
      return attemptsSoFar + 1 >= MAX_CALL_ATTEMPTS
        ? { taskStatus: "SKIPPED", leadStatus: "NO_RESPONSE" }
        : { taskStatus: "OPEN", retryInDays: 1 };
  }
}
