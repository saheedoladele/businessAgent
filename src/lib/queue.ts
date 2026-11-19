import { Queue } from "bullmq";
import { Redis } from "ioredis";

/**
 * One BullMQ queue ("agent") carries every job type. The dashboard and
 * scripts enqueue work here; the worker process (npm run worker) runs it.
 */

export const QUEUE_NAME = "agent";

export type AgentJob =
  | { name: "tick"; data: Record<string, never> }
  | { name: "inbox"; data: Record<string, never> }
  | { name: "discover"; data: { searchRunId: string } }
  | { name: "enrich"; data: { leadId: string } }
  | { name: "draft"; data: { leadId: string } }
  | { name: "send-batch"; data: { businessId: string } }
  | { name: "follow-up"; data: { leadId: string } };

export function redisConnection(): Redis {
  // BullMQ requires maxRetriesPerRequest: null for blocking commands.
  return new Redis(process.env.REDIS_URL ?? "redis://localhost:6380", { maxRetriesPerRequest: null });
}

const globalForQueue = globalThis as unknown as { agentQueue?: Queue };

export function agentQueue(): Queue {
  globalForQueue.agentQueue ??= new Queue(QUEUE_NAME, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: true, // lets the same jobId be queued again later
      removeOnFail: 200,
    },
  });
  return globalForQueue.agentQueue;
}

/**
 * Enqueue a job. `jobId` de-duplicates: while a job with the same id is
 * waiting or running, adding it again is a no-op.
 */
export async function enqueue<J extends AgentJob>(name: J["name"], data: J["data"], jobId?: string) {
  return agentQueue().add(name, data, jobId ? { jobId } : undefined);
}
