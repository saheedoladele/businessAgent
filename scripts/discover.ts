/**
 * Run lead discovery for one business from the terminal.
 *   npm run discover -- <businessId> ["optional extra instructions"]
 */
import { createSearchRun, runDiscovery } from "@/agent/discover";
import { db } from "@/lib/db";

async function main() {
  const [businessId, query] = process.argv.slice(2);
  if (!businessId) throw new Error("Usage: npm run discover -- <businessId> [query]");

  const run = await createSearchRun(businessId, query);
  console.log("Searching the web for prospects (this can take a minute)...");
  const saved = await runDiscovery(run.id);

  const leads = await db.lead.findMany({ where: { searchRunId: run.id } });
  console.log(`\nSaved ${saved} new leads:`);
  for (const l of leads) {
    console.log(`- ${l.companyName} (${l.domain})${l.email ? ` <${l.email}>` : ""}\n  ${l.fitReason ?? ""}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
