import { PrismaClient } from "@prisma/client";

// Reuse one client across hot reloads in dev (Next.js re-imports modules).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/** Write an entry to the agent's activity timeline. */
export async function logActivity(
  businessId: string,
  type: string,
  detail: string,
  leadId?: string,
) {
  await db.activity.create({ data: { businessId, type, detail, leadId } });
}
