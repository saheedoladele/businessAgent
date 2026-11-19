/**
 * Research and score every NEW lead for a business.
 *   npm run enrich -- <businessId>
 */
import { enrichLead } from "@/agent/enrich";
import { db } from "@/lib/db";

async function main() {
  const [businessId] = process.argv.slice(2);
  if (!businessId) throw new Error("Usage: npm run enrich -- <businessId>");

  const leads = await db.lead.findMany({ where: { businessId, status: "NEW" } });
  console.log(`Enriching ${leads.length} leads...\n`);
  for (const lead of leads) {
    try {
      const r = await enrichLead(lead.id);
      const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
      console.log(`${r.status === "QUALIFIED" ? "✔" : "✘"} ${lead.companyName} [${fresh.fitScore}] ${fresh.email ?? ""}\n  ${r.reason}`);
    } catch (e) {
      console.log(`! ${lead.companyName}: ${(e as Error).message}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
