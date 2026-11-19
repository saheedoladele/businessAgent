/**
 * Draft first emails for every QUALIFIED lead of a business and print them.
 *   npm run draft -- <businessId>
 */
import { draftFirstEmail } from "@/agent/write-email";
import { db } from "@/lib/db";

async function main() {
  const [businessId] = process.argv.slice(2);
  if (!businessId) throw new Error("Usage: npm run draft -- <businessId>");

  const leads = await db.lead.findMany({ where: { businessId, status: "QUALIFIED" } });
  console.log(`Drafting emails for ${leads.length} qualified leads...\n`);
  for (const lead of leads) {
    try {
      const m = await draftFirstEmail(lead.id);
      console.log(`=== To: ${lead.email} (${lead.companyName}) [${m.status}]\nSubject: ${m.subject}\n\n${m.body}\n`);
    } catch (e) {
      console.log(`! ${lead.companyName}: ${(e as Error).message}\n`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
