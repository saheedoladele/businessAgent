import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pause, Play, Search } from "lucide-react";
import { LiveRefresh } from "@/components/live-refresh";
import { PipelineTrail } from "@/components/pipeline-trail";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Time } from "@/components/ui";
import { db } from "@/lib/db";
import { runDiscovery, toggleActive, updateBusiness } from "../actions";
import { BusinessForm } from "../business-form";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await db.business.findUnique({ where: { id }, select: { name: true } });
  return { title: b?.name ?? "Business" };
}

export default async function BusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await db.business.findUnique({ where: { id } });
  if (!business) notFound();

  const [byStatus, runs] = await Promise.all([
    db.lead.groupBy({ by: ["status"], where: { businessId: id }, _count: true }),
    db.searchRun.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const counts = Object.fromEntries(byStatus.map((c) => [c.status, c._count]));
  const searching = runs.some((r) => r.status === "QUEUED" || r.status === "RUNNING");

  return (
    <div className="stack">
      {searching && <LiveRefresh seconds={8} />}
      <div>
        <Link href="/businesses" className="back">
          <ArrowLeft size={14} aria-hidden /> Businesses
        </Link>
        <header className="page-head" style={{ marginBottom: 0 }}>
          <div>
            <h1>{business.name}</h1>
            <p className="lede">
              {business.active ? "The agent is running for this business." : "The agent is paused. Nothing will be sent."} Emails go out as{" "}
              {business.senderName} ({business.senderEmail}).
            </p>
          </div>
          <form action={toggleActive.bind(null, id)}>
            <SubmitButton
              className={`btn ${business.active ? "btn-ghost-danger" : "btn-primary"}`}
              pendingText={business.active ? "Pausing…" : "Resuming…"}
            >
              {business.active ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
              {business.active ? "Pause agent" : "Resume agent"}
            </SubmitButton>
          </form>
        </header>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Find new leads</h2>
            <p className="hint" style={{ marginTop: 4 }}>
              Claude searches the web using your ideal customer. Add a focus to narrow it down.
            </p>
          </div>
        </div>
        <form action={runDiscovery.bind(null, id)} className="searchbar">
          <div className="input-icon">
            <Search size={16} aria-hidden />
            <input type="text" name="query" placeholder="Optional focus, e.g. private schools in Lekki" aria-label="Search focus" />
          </div>
          <SubmitButton pendingText="Starting search…">Search the web</SubmitButton>
        </form>
        {runs.length > 0 && (
          <div className="list" style={{ marginTop: 16 }}>
            {runs.map((r) => (
              <div key={r.id} className="list-item">
                <div className="grow">
                  <div className="title">{r.query ?? "Ideal customer search"}</div>
                  <div className="sub">
                    {r.status === "DONE"
                      ? `${r.leadsFound} new lead${r.leadsFound === 1 ? "" : "s"} found`
                      : r.status === "FAILED"
                        ? r.error?.slice(0, 140)
                        : r.status === "QUEUED"
                          ? "Waiting for the agent to pick this up"
                          : "Searching the web now"}
                  </div>
                </div>
                <Badge value={r.status} />
                <Time date={r.createdAt} />
              </div>
            ))}
          </div>
        )}
      </section>

      <PipelineTrail counts={counts} businessId={id} />

      <BusinessForm business={business} action={updateBusiness.bind(null, id)} submitLabel="Save changes" pendingLabel="Saving…" />
    </div>
  );
}
