import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Crosshair } from "lucide-react";
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Toast } from "@/components/toast";
import { workerOnline } from "@/lib/agent-status";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: { default: "LeadHunter", template: "%s · LeadHunter" },
  description: "AI agent that finds customers and books meetings for your business",
};

// Every page reads live data from the database.
export const dynamic = "force-dynamic";

async function sidebarData() {
  const [approvals, calls, online] = await Promise.all([
    db.message.count({ where: { status: "DRAFT", direction: "OUTBOUND" } }).catch(() => 0),
    db.callTask.count({ where: { status: "OPEN", dueAt: { lte: new Date() } } }).catch(() => 0),
    workerOnline(),
  ]);
  return { counts: { approvals, calls }, online };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { counts, online } = await sidebarData();
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand">
              <span className="brand-mark">
                <Crosshair size={18} strokeWidth={2.4} aria-hidden />
              </span>
              LeadHunter
            </Link>
            <Nav counts={counts} />
            <div className={`agent-light${online ? " on" : ""}`} title="Start it with: npm run worker">
              <span className="dot" aria-hidden />
              <div>
                <div>{online ? "Agent is working" : "Agent is stopped"}</div>
                <div className="sub">
                  {online === null ? "Can't reach Redis" : online ? "Checking every few minutes" : "Run npm run worker"}
                </div>
              </div>
            </div>
          </aside>
          <main className="content">{children}</main>
        </div>
        <Suspense>
          <Toast />
        </Suspense>
      </body>
    </html>
  );
}
