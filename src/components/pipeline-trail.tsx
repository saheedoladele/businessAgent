import Link from "next/link";

/**
 * The pipeline as a trail: where every lead currently stands, left to right.
 * Segment width follows the count (with a floor so small stages stay clickable).
 */
const STAGES = [
  { label: "Found", statuses: ["NEW"] },
  { label: "Qualified", statuses: ["QUALIFIED", "PENDING_APPROVAL"] },
  { label: "Emailing", statuses: ["CONTACTED"] },
  { label: "Replied", statuses: ["REPLIED"] },
  { label: "Interested", statuses: ["INTERESTED"] },
  { label: "Booked", statuses: ["MEETING_SCHEDULED"] },
];

export function PipelineTrail({ counts, businessId }: { counts: Record<string, number>; businessId?: string }) {
  const sum = (s: string[]) => s.reduce((a, k) => a + (counts[k] ?? 0), 0);
  const stages = STAGES.map((s) => ({ ...s, n: sum(s.statuses) }));
  const callOnly = sum(["NEEDS_CALL"]);
  const dropped = sum(["DISQUALIFIED", "NOT_INTERESTED", "UNSUBSCRIBED", "BOUNCED", "NO_RESPONSE"]);
  const qs = (status: string) => `/leads?status=${status}${businessId ? `&business=${businessId}` : ""}`;

  return (
    <section className="trail" aria-label="Pipeline">
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2>Where your leads are now</h2>
        <Link href={businessId ? `/leads?business=${businessId}` : "/leads"}>See all leads</Link>
      </div>
      <div className="trail-bar">
        {stages.map((s) => (
          <Link
            key={s.label}
            href={qs(s.statuses[0])}
            className={`trail-seg${s.n === 0 ? " zero" : ""}`}
            style={{ flex: `${Math.max(s.n, 1)} 1 0` }}
            title={`${s.n} ${s.label.toLowerCase()}`}
          >
            <span className="n">{s.n}</span>
            <span className="l">{s.label}</span>
          </Link>
        ))}
      </div>
      <div className="trail-foot">
        <Link href={qs("NEEDS_CALL")}>{callOnly} reachable by phone only</Link>
        <Link href={qs("DISQUALIFIED")}>{dropped} dropped (not a fit, declined, bounced or no reply)</Link>
      </div>
    </section>
  );
}
