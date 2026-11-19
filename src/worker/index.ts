import { Worker, type Job } from "bullmq";
import { runDiscovery, createSearchRun } from "@/agent/discover";
import { enrichLead } from "@/agent/enrich";
import { processInbox } from "@/agent/inbox";
import { sendApproved } from "@/agent/send";
import { advanceLead, dueLeads } from "@/agent/sequence";
import { draftFirstEmail } from "@/agent/write-email";
import { db } from "@/lib/db";
import { agentQueue, enqueue, QUEUE_NAME, redisConnection } from "@/lib/queue";
import { isWithinSendWindow } from "@/lib/send-window";

/**
 * The agent's engine. Every few minutes a "tick" looks at each active
 * business and queues whatever is due:
 *   NEW leads → enrich → QUALIFIED → draft → (approve) → send → follow-ups
 * and every couple of minutes an "inbox" job handles replies.
 * Each step runs as its own job, so one failure never blocks the rest
 * and failed jobs retry with backoff.
 */

const TICK_EVERY_MS = Number(process.env.TICK_EVERY_MINUTES || 5) * 60_000;
const INBOX_EVERY_MS = Number(process.env.INBOX_EVERY_MINUTES || 2) * 60_000;
const DAY = 24 * 60 * 60 * 1000;

async function tick() {
  const businesses = await db.business.findMany({ where: { active: true } });
  for (const b of businesses) {
    // 1. Research new leads.
    const fresh = await db.lead.findMany({ where: { businessId: b.id, status: "NEW" }, select: { id: true }, take: 50 });
    for (const l of fresh) await enqueue("enrich", { leadId: l.id }, `enrich-${l.id}`);

    // 2. Draft first emails for qualified leads that don't have one yet.
    const toDraft = await db.lead.findMany({
      where: { businessId: b.id, status: "QUALIFIED", messages: { none: { step: 0, direction: "OUTBOUND" } } },
      select: { id: true },
      take: 50,
    });
    for (const l of toDraft) await enqueue("draft", { leadId: l.id }, `draft-${l.id}`);

    // 3. Send approved emails, only during the send window.
    if (isWithinSendWindow()) {
      const pending = await db.message.count({ where: { status: "APPROVED", direction: "OUTBOUND", lead: { businessId: b.id } } });
      if (pending) await enqueue("send-batch", { businessId: b.id }, `send-${b.id}`);
    }

    // 4. Top up the pipeline once a day if enabled and it's running low.
    if (b.autoDiscover) {
      const recentRun = await db.searchRun.findFirst({
        where: { businessId: b.id, createdAt: { gte: new Date(Date.now() - DAY) } },
      });
      const ready = await db.lead.count({
        where: { businessId: b.id, status: { in: ["NEW", "QUALIFIED", "PENDING_APPROVAL"] } },
      });
      if (!recentRun && ready < b.dailySendLimit) {
        const run = await createSearchRun(b.id);
        await enqueue("discover", { searchRunId: run.id }, `discover-${run.id}`);
      }
    }
  }

  // 5. Follow-ups that are due (any business).
  for (const l of await dueLeads()) await enqueue("follow-up", { leadId: l.id }, `follow-up-${l.id}`);
}

async function handle(job: Job) {
  switch (job.name) {
    case "tick":
      return tick();
    case "inbox":
      return processInbox();
    case "discover":
      return runDiscovery(job.data.searchRunId);
    case "enrich":
      return enrichLead(job.data.leadId);
    case "draft":
      return draftFirstEmail(job.data.leadId);
    case "send-batch":
      return sendApproved(job.data.businessId);
    case "follow-up":
      return advanceLead(job.data.leadId);
    default:
      throw new Error(`Unknown job: ${job.name}`);
  }
}

async function main() {
  // Repeating tick (upsert = safe to call on every start).
  await agentQueue().upsertJobScheduler("tick", { every: TICK_EVERY_MS }, { name: "tick", data: {} });
  await agentQueue().upsertJobScheduler("inbox", { every: INBOX_EVERY_MS }, { name: "inbox", data: {} });

  const worker = new Worker(QUEUE_NAME, handle, {
    connection: redisConnection(),
    concurrency: Number(process.env.WORKER_CONCURRENCY || 3),
  });

  worker.on("completed", (job) => {
    if (job.name === "inbox") {
      // Each job type returns something different; for inbox it's { checked, matched }.
      const { matched } = (job.returnvalue ?? {}) as { matched?: number };
      if (matched) console.log(`✔ inbox: ${matched} new replies`);
    } else if (job.name !== "tick") {
      console.log(`✔ ${job.name} ${job.id}`);
    }
  });
  worker.on("failed", (job, err) => {
    console.error(`✘ ${job?.name} ${job?.id} (attempt ${job?.attemptsMade}): ${err.message}`);
  });

  console.log(
    `LeadHunter worker running. Pipeline every ${TICK_EVERY_MS / 60_000} min, inbox every ${INBOX_EVERY_MS / 60_000} min. Ctrl+C to stop.`,
  );

  const shutdown = async () => {
    console.log("Shutting down (finishing current jobs)...");
    await worker.close();
    await agentQueue().close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
