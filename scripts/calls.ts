/**
 * Your call list: open call tasks with script and WhatsApp link.
 *   npm run calls                 # all businesses
 *   npm run calls -- <businessId>
 */
import { db } from "@/lib/db";
import { whatsappLink } from "@/lib/phone";

async function main() {
  const [businessId] = process.argv.slice(2);
  const tasks = await db.callTask.findMany({
    where: { status: "OPEN", dueAt: { lte: new Date() }, ...(businessId ? { lead: { businessId } } : {}) },
    include: { lead: true },
    orderBy: { dueAt: "asc" },
  });
  if (!tasks.length) return console.log("No calls due. 🎉");

  for (const t of tasks) {
    console.log(`\n${"=".repeat(70)}
☎  ${t.lead.companyName}${t.lead.contactName ? ` — ${t.lead.contactName}` : ""}   ${t.phone}
   Reason: ${t.reason}   Attempts: ${t.attempts}   Task ID: ${t.id}
   WhatsApp: ${whatsappLink(t.phone, t.whatsappText)}
${"-".repeat(70)}
${t.script}`);
  }
  console.log(`\nAfter each call: npm run call:done -- <taskId> <BOOKED|INTERESTED|CALLBACK|NOT_INTERESTED|NO_ANSWER|WRONG_NUMBER> "notes"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
