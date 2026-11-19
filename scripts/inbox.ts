/**
 * Check the inbox once and process replies.
 *   npm run inbox
 */
import { processInbox } from "@/agent/inbox";
import { db } from "@/lib/db";
import { imapConfigured } from "@/lib/inbox";

async function main() {
  if (!imapConfigured()) throw new Error("Set IMAP_HOST (and IMAP_USER/IMAP_PASS or SMTP_USER/SMTP_PASS) in .env");
  const r = await processInbox();
  console.log(`Checked ${r.checked} recent emails, ${r.matched} new replies from leads.`);
  const recent = await db.activity.findMany({
    where: { type: { startsWith: "reply." } },
    orderBy: { createdAt: "desc" },
    take: r.matched,
  });
  for (const a of recent) console.log(`- ${a.detail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
