import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages used by the agent (added in later chunks)
  serverExternalPackages: ["@prisma/client", "bullmq", "ioredis", "imapflow", "nodemailer"],
};

export default nextConfig;
