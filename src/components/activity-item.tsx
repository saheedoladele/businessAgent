import Link from "next/link";
import { Activity, CalendarCheck, Mail, MessageCircle, Phone, Radar, Search, Users, CircleAlert } from "lucide-react";
import { Time } from "./ui";

/** One line in an activity timeline, with an icon that says what kind of event it was. */
export function ActivityItem({ a }: { a: { id: string; type: string; detail: string; createdAt: Date; leadId: string | null } }) {
  const [group] = a.type.split(".");
  const bad = /bounced|failed|unsubscribed/.test(a.type);
  const good = /interested|booked|qualified/.test(a.type) && !a.type.includes("not_interested") && !a.type.includes("disqualified");
  const needsYou = /needs_you|needs_call|call\.task|question|drafted/.test(a.type);
  const Icon =
    bad ? CircleAlert
    : group === "email" ? Mail
    : group === "reply" ? MessageCircle
    : group === "meeting" ? CalendarCheck
    : group === "call" ? Phone
    : group === "search" ? Search
    : group === "lead" ? (a.type === "lead.found" ? Radar : Users)
    : Activity;
  const tone = bad ? "berry" : good ? "" : needsYou ? "brass" : "sky";
  const text = a.detail.replace(/^\p{Extended_Pictographic}\s*/u, "");

  return (
    <div className="list-item">
      <span className={`icon-chip ${tone}`}>
        <Icon size={15} aria-hidden />
      </span>
      <div className="grow">{a.leadId ? <Link href={`/leads/${a.leadId}`} style={{ color: "inherit" }}>{text}</Link> : text}</div>
      <Time date={a.createdAt} />
    </div>
  );
}
