import Link from "next/link";
import { CalendarCheck, Inbox, Phone, Plus } from "lucide-react";
import { ActivityItem } from "@/components/activity-item";
import { LiveRefresh } from "@/components/live-refresh";
import { PipelineTrail } from "@/components/pipeline-trail";
import { Time } from "@/components/ui";
import { db } from "@/lib/db";

function greeting(timeZone = process.env.SEND_TIMEZONE || "UTC") {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(new Date()));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function OverviewPage() {
  const business = await db.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (!business) return <Welcome />;

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const now = new Date();

  const [byStatus, drafts, draftCount, calls, meetings, sentToday, activity] = await Promise.all([
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.message.findMany({
      where: { status: "DRAFT", direction: "OUTBOUND" },
      include: { lead: { select: { companyName: true } } },
      orderBy: { createdAt: "asc" },
      take: 4,
    }),
    db.message.count({ where: { status: "DRAFT", direction: "OUTBOUND" } }),
    db.callTask.findMany({
      where: { status: "OPEN", dueAt: { lte: now } },
      include: { lead: { select: { companyName: true } } },
      orderBy: { dueAt: "asc" },
      take: 4,
    }),
    db.meeting.findMany({
      where: { cancelledAt: null, startsAt: { gte: now } },
      include: { lead: { select: { companyName: true, contactName: true } } },
      orderBy: { startsAt: "asc" },
      take: 5,
    }),
    db.message.count({ where: { direction: "OUTBOUND", status: "SENT", channel: "EMAIL", sentAt: { gte: startOfDay } } }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const counts = Object.fromEntries(byStatus.map((c) => [c.status, c._count]));
  const firstName = business.senderName.split(" ")[0];

  const summary = [
    sentToday ? `The agent has sent ${sentToday} email${sentToday === 1 ? "" : "s"} today.` : "No emails sent yet today.",
    draftCount ? `${draftCount} draft${draftCount === 1 ? " is" : "s are"} waiting for your approval.` : "Nothing is waiting for you.",
  ].join(" ");

  return (
    <div className="stack">
      <LiveRefresh />
      <header className="page-head">
        <div>
          <h1>
            {greeting()}, {firstName}
          </h1>
          <p className="lede">{summary}</p>
        </div>
        <Link href={`/businesses/${business.id}`} className="btn btn-primary">
          <Plus size={16} aria-hidden /> Find new leads
        </Link>
      </header>

      <PipelineTrail counts={counts} />

      <div className="cols">
        <section className="panel">
          <div className="panel-head">
            <h2>Needs you</h2>
            {draftCount > drafts.length && <Link href="/approvals">All {draftCount} approvals</Link>}
          </div>
          {drafts.length === 0 && calls.length === 0 ? (
            <p className="empty-note">You&apos;re all caught up. New drafts and calls will appear here.</p>
          ) : (
            <div className="list">
              {drafts.map((m) => (
                <Link key={m.id} href="/approvals" className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
                  <span className="icon-chip brass">
                    <Inbox size={15} aria-hidden />
                  </span>
                  <div className="grow">
                    <div className="title">Approve email to {m.lead.companyName}</div>
                    <div className="sub">{m.subject}</div>
                  </div>
                  <Time date={m.createdAt} />
                </Link>
              ))}
              {calls.map((c) => (
                <Link key={c.id} href="/calls" className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
                  <span className="icon-chip brass">
                    <Phone size={15} aria-hidden />
                  </span>
                  <div className="grow">
                    <div className="title">Call {c.lead.companyName}</div>
                    <div className="sub">{c.phone}</div>
                  </div>
                  <Time date={c.dueAt} />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Upcoming meetings</h2>
            <Link href="/meetings">All meetings</Link>
          </div>
          {meetings.length === 0 ? (
            <p className="empty-note">No meetings booked yet. They appear here as soon as a lead books through your link.</p>
          ) : (
            <div className="list">
              {meetings.map((m) => (
                <Link key={m.id} href={`/leads/${m.leadId}`} className="list-item" style={{ color: "inherit", textDecoration: "none" }}>
                  <span className="icon-chip">
                    <CalendarCheck size={15} aria-hidden />
                  </span>
                  <div className="grow">
                    <div className="title">{m.lead.companyName}</div>
                    <div className="sub">
                      {m.startsAt.toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {m.lead.contactName ? ` with ${m.lead.contactName}` : ""}
                    </div>
                  </div>
                  <Time date={m.startsAt} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>What the agent did</h2>
          <Link href="/activity">Full history</Link>
        </div>
        {activity.length === 0 ? (
          <p className="empty-note">Nothing yet. Run a lead search to get started.</p>
        ) : (
          <div className="list">
            {activity.map((a) => (
              <ActivityItem key={a.id} a={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Welcome() {
  return (
    <div className="welcome">
      <h1>Let&apos;s find your next customers</h1>
      <p>Describe your business once. The agent searches the web for companies that fit, emails them, follows up and books meetings into your calendar.</p>
      <ol className="steps">
        <li>Describe what you sell and who you want to reach</li>
        <li>Run a lead search and review who it found</li>
        <li>Approve the first emails; the agent handles follow-ups and replies</li>
      </ol>
      <Link href="/businesses/new" className="btn btn-primary">
        Set up your business
      </Link>
    </div>
  );
}
