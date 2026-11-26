import { agentQueue } from "./queue";

/**
 * Is `npm run worker` running? BullMQ records connected workers in Redis.
 * Returns null if Redis itself can't be reached.
 */
export async function workerOnline(): Promise<boolean | null> {
  try {
    const count = await Promise.race([
      agentQueue().getWorkersCount(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500)),
    ]);
    return count > 0;
  } catch {
    return null;
  }
}
