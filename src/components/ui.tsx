import Link from "next/link";

/** Small shared UI pieces for the dashboard (server components, no client JS). */

const STATUS_COLORS: Record<string, string> = {
  NEW: "gray",
  QUALIFIED: "blue",
  NEEDS_CALL: "purple",
  PENDING_APPROVAL: "amber",
  CONTACTED: "blue",
  REPLIED: "amber",
  INTERESTED: "green",
  MEETING_SCHEDULED: "green",
  DISQUALIFIED: "gray",
  NOT_INTERESTED: "gray",
  UNSUBSCRIBED: "red",
  BOUNCED: "red",
  NO_RESPONSE: "gray",
  // messages / tasks / runs
  DRAFT: "amber",
  APPROVED: "blue",
  SENT: "green",
  FAILED: "red",
  RECEIVED: "purple",
  OPEN: "amber",
  CALLING: "blue",
  DONE: "green",
  SKIPPED: "gray",
  QUEUED: "gray",
  RUNNING: "blue",
};

export function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${STATUS_COLORS[value] ?? "gray"}`}>{value.replace(/_/g, " ").toLowerCase()}</span>;
}

export function Stat({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const body = (
    <>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="stat card">
      {body}
    </Link>
  ) : (
    <div className="stat card">{body}</div>
  );
}

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  if (error) return <div className="flash flash-error">{error}</div>;
  if (notice) return <div className="flash flash-ok">{notice}</div>;
  return null;
}

export function timeAgo(date: Date | null | undefined): string {
  if (!date) return "—";
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  const abs = Math.abs(s);
  const fmt = (n: number, unit: string) => `${n}${unit}`;
  const v =
    abs < 60 ? fmt(abs, "s") : abs < 3600 ? fmt(Math.round(abs / 60), "m") : abs < 86400 ? fmt(Math.round(abs / 3600), "h") : fmt(Math.round(abs / 86400), "d");
  return s >= 0 ? `${v} ago` : `in ${v}`;
}
