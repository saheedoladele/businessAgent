"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, CalendarCheck, Inbox, LayoutDashboard, Phone, Users } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/approvals", label: "Approvals", icon: Inbox, countKey: "approvals" },
  { href: "/calls", label: "Calls", icon: Phone, countKey: "calls" },
  { href: "/meetings", label: "Meetings", icon: CalendarCheck },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/businesses", label: "Businesses", icon: Building2 },
] as const;

export function Nav({ counts }: { counts: { approvals: number; calls: number } }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map(({ href, label, icon: Icon, ...rest }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        const count = "countKey" in rest ? counts[rest.countKey] : 0;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            <Icon size={17} strokeWidth={2} aria-hidden />
            {label}
            {count > 0 && (
              <span className="count" aria-label={`${count} waiting`}>
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
