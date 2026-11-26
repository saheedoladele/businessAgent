import Link from "next/link";
import { Stat, timeAgo } from "@/components/ui";
import { db } from "@/lib/db";

export default async function OverviewPage() {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const [businesses, byStatus, drafts, callsDue, upcoming, sentToday, recent] = await Promise.all([
    db.business.count(),
    db.lead.groupBy({ by: ["status"], _count: true }),
    db.message.count({ where: { status: "DRAFT", direction: "OUTBOUND" } }),
    db.callTask.count({ where: { status: "OPEN", dueAt: { lte: new Date() } } }),
    db.meeting.findMany({
      where: { cancelledAt: null, startsAt: { gte: new Date() } },
      include: { lead: true },
      orderBy: { startsAt: "asc" },
      take: 5,
    }),
    db.message.count({ where: { direction: "OUTBOUND", status: "SENT", channel: "EMAIL", sentAt: { gte: startOfDay } } }),
    db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { lead: { select: { id: true } } } }),
  ]);

  if (businesses === 0) {
    return (
      <div className="card empty">
        <h1>Welcome to LeadHunter</h1>
        <p>Set up your business and the agent will find prospects, email them, follow up and book meetings.</p>
        <Link href="/businesses/new" className="btn btn-primary">
          Set up your business
        </Link>
      </div>
    );
  }

  const n = (...s: string[]) => byStatus.filter((c) => s.includes(c.status)).reduce((a, c) => a + c._count, 0);
  const total = byStatus.reduce((a, c) => a + c._count, 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">Keep `npm run worker` running so the agent can work.</p>
        </div>
      </div>

      <div className="grid grid-stats">
        <Stat label="Needs your approval" value={drafts} href="/approvals" />
        <Stat label="Calls due" value={callsDue} href="/calls" />
        <Stat label="Emails sent today" value={sentToday} />
        <Stat label="Upcoming meetings" value={upcoming.length} href="/meetings" />
      </div>

      <div className="card">
        <h2>Pipeline</h2>
        <div className="grid grid-stats">
          <Stat label="All leads" value={total} href="/leads" />
          <Stat label="New" value={n("NEW")} href="/leads?status=NEW" />
          <Stat label="Qualified" value={n("QUALIFIED", "PENDING_APPROVAL")} href="/leads?status=QUALIFIED" />
          <Stat label="In sequence" value={n("CONTACTED")} href="/leads?status=CONTACTED" />
          <Stat label="Replied" value={n("REPLIED")} href="/leads?status=REPLIED" />
          <Stat label="Interested" value={n("INTERESTED")} href="/leads?status=INTERESTED" />
          <Stat label="Meetings" value={n("MEETING_SCHEDULED")} href="/leads?status=MEETING_SCHEDULED" />
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Upcoming meetings</h2>
          {upcoming.length === 0 ? (
            <p className="muted">None yet.</p>
          ) : (
            upcoming.map((m) => (
              <p key={m.id}>
                <Link href={`/leads/${m.leadId}`}>{m.lead.companyName}</Link> · {m.startsAt.toLocaleString("en-GB")}
              </p>
            ))
          )}
        </div>
        <div className="card">
          <h2>Latest activity</h2>
          {recent.map((a) => (
            <p key={a.id} style={{ margin: "0 0 6px" }}>
              <span className="muted">{timeAgo(a.createdAt)}</span> ·{" "}
              {a.lead ? <Link href={`/leads/${a.lead.id}`}>{a.detail}</Link> : a.detail}
            </p>
          ))}
          <Link href="/activity">All activity →</Link>
        </div>
      </div>
    </div>
  );
}
