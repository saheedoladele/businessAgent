/**
 * Record a call outcome.
 *   npm run call:done -- <taskId> <OUTCOME> ["notes"]
 */
import { completeCallTask } from "@/agent/calls";
import { CALL_OUTCOMES, type CallOutcome } from "@/lib/call-rules";
import { db } from "@/lib/db";

async function main() {
  const [taskId, outcome, notes] = process.argv.slice(2);
  if (!taskId || !CALL_OUTCOMES.includes(outcome as CallOutcome)) {
    throw new Error(`Usage: npm run call:done -- <taskId> <${CALL_OUTCOMES.join("|")}> ["notes"]`);
  }
  await completeCallTask(taskId, outcome as CallOutcome, notes);
  console.log("Saved.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
