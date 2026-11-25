/**
 * Create a call task for one lead right now (reason MANUAL).
 *   npm run call:create -- <leadId>
 */
import { createCallTask } from "@/agent/calls";
import { db } from "@/lib/db";
import { toE164 } from "@/lib/phone";

async function main() {
  const [leadId] = process.argv.slice(2);
  if (!leadId) throw new Error("Usage: npm run call:create -- <leadId>");
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (!lead.phone) throw new Error(`${lead.companyName} has no phone number. Add one in Prisma Studio first.`);
  if (!toE164(lead.phone)) throw new Error(`Can't read phone number "${lead.phone}". Check DEFAULT_COUNTRY_CODE in .env.`);

  console.log(`Writing call script for ${lead.companyName}...`);
  const task = await createCallTask(leadId, "MANUAL");
  console.log(task ? `Created task ${task.id}. Run: npm run calls` : "No task created.");
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
