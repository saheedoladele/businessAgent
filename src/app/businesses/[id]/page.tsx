import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Flash, Stat, timeAgo } from "@/components/ui";
import { db } from "@/lib/db";
import { runDiscovery, toggleActive, updateBusiness } from "../actions";
import { BusinessForm } from "../business-form";

export default async function BusinessPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { id } = await params;
  const { error, notice } = await searchParams;
  const business = await db.business.findUnique({ where: { id } });
  if (!business) notFound();

  const [counts, runs] = await Promise.all([
    db.lead.groupBy({ by: ["status"], where: { businessId: id }, _count: true }),
    db.searchRun.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const count = (...statuses: string[]) =>
    counts.filter((c) => statuses.includes(c.status)).reduce((sum, c) => sum + c._count, 0);
  const total = counts.reduce((sum, c) => sum + c._count, 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{business.name}</h1>
          <p className="muted">
            Agent is <strong>{business.active ? "running" : "paused"}</strong> · sending as {business.senderName} &lt;
            {business.senderEmail}&gt;
          </p>
        </div>
        <form action={toggleActive.bind(null, id)}>
          <button className={`btn ${business.active ? "btn-danger" : "btn-primary"}`}>
            {business.active ? "Pause agent" : "Resume agent"}
          </button>
        </form>
      </div>
      <Flash error={error} notice={notice} />

      <div className="grid grid-stats">
        <Stat label="Leads" value={total} href={`/leads?business=${id}`} />
        <Stat label="Qualified" value={count("QUALIFIED", "PENDING_APPROVAL")} href={`/leads?business=${id}&status=QUALIFIED`} />
        <Stat label="In sequence" value={count("CONTACTED")} href={`/leads?business=${id}&status=CONTACTED`} />
        <Stat label="Replied" value={count("REPLIED", "INTERESTED")} href={`/leads?business=${id}&status=INTERESTED`} />
        <Stat label="Meetings" value={count("MEETING_SCHEDULED")} href={`/leads?business=${id}&status=MEETING_SCHEDULED`} />
        <Stat label="Call only" value={count("NEEDS_CALL")} href={`/leads?business=${id}&status=NEEDS_CALL`} />
      </div>

      <div className="card">
        <h2>Find new leads</h2>
        <form action={runDiscovery.bind(null, id)} className="row">
          <input
            type="text"
            name="query"
            placeholder='Optional focus, e.g. "private schools in Lekki" or "logistics firms hiring drivers"'
            style={{ flex: 1, minWidth: 260 }}
          />
          <button className="btn btn-primary">Search the web</button>
        </form>
        {runs.length > 0 && (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Focus</th>
                  <th>Status</th>
                  <th>New leads</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{timeAgo(r.createdAt)}</td>
                    <td>{r.query ?? <span className="muted">ideal customer</span>}</td>
                    <td>
                      <Badge value={r.status} />
                      {r.error && <div className="muted">{r.error.slice(0, 160)}</div>}
                    </td>
                    <td>{r.status === "DONE" ? r.leadsFound : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BusinessForm business={business} action={updateBusiness.bind(null, id)} submitLabel="Save changes" />
      <p className="muted">
        <Link href="/businesses">← All businesses</Link>
      </p>
    </div>
  );
}
