import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadHunter",
  description: "AI agent that finds customers and books meetings for your business",
};

// Every page reads live data from the database.
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/businesses", label: "Businesses" },
  { href: "/leads", label: "Leads" },
  { href: "/approvals", label: "Approvals" },
  { href: "/calls", label: "Calls" },
  { href: "/meetings", label: "Meetings" },
  { href: "/activity", label: "Activity" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar">
            <Link href="/" className="brand">
              LeadHunter
            </Link>
            <nav>
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
