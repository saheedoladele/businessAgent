/**
 * Send all APPROVED emails for a business (respects the daily limit).
 *   npm run send -- <businessId>
 */
import { sendApproved } from "@/agent/send";
import { db } from "@/lib/db";

async function main() {
  const [businessId] = process.argv.slice(2);
  if (!businessId) throw new Error("Usage: npm run send -- <businessId>");
  const results = await sendApproved(businessId);
  const sent = results.filter((r) => r.ok).length;
  console.log(`Sent ${sent} of ${results.length} approved emails.`);
  for (const r of results) if (!r.ok) console.log(`- ${r.reason}: ${r.detail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
