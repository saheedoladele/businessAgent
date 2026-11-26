/** Shared, server-rendered UI pieces. */

const STATUS_COLORS: Record<string, string> = {
  NEW: "gray",
  QUALIFIED: "green",
  NEEDS_CALL: "purple",
  PENDING_APPROVAL: "brass",
  CONTACTED: "blue",
  REPLIED: "brass",
  INTERESTED: "green",
  MEETING_SCHEDULED: "green",
  DISQUALIFIED: "gray",
  NOT_INTERESTED: "gray",
  UNSUBSCRIBED: "berry",
  BOUNCED: "berry",
  NO_RESPONSE: "gray",
  DRAFT: "brass",
  APPROVED: "blue",
  SENT: "green",
  FAILED: "berry",
  RECEIVED: "purple",
  OPEN: "brass",
  CALLING: "blue",
  DONE: "green",
  SKIPPED: "gray",
  QUEUED: "gray",
  RUNNING: "blue",
};

/** Human labels for statuses (sentence case, user words not system words). */
const STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  NEEDS_CALL: "Call only",
  PENDING_APPROVAL: "Awaiting approval",
  CONTACTED: "Emailing",
  REPLIED: "Replied",
  INTERESTED: "Interested",
  MEETING_SCHEDULED: "Meeting booked",
  DISQUALIFIED: "Not a fit",
  NOT_INTERESTED: "Declined",
  UNSUBSCRIBED: "Unsubscribed",
  BOUNCED: "Bounced",
  NO_RESPONSE: "No response",
  DRAFT: "Draft",
  APPROVED: "Queued to send",
  SENT: "Sent",
  FAILED: "Failed",
  RECEIVED: "Received",
  OPEN: "To do",
  CALLING: "Calling",
  DONE: "Done",
  SKIPPED: "Skipped",
  QUEUED: "Queued",
  RUNNING: "Searching",
};

export function statusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ");
}

export function Badge({ value }: { value: string }) {
  return <span className={`badge badge-${STATUS_COLORS[value] ?? "gray"}`}>{statusLabel(value)}</span>;
}

/** "5m ago" / "in 2d", with the exact time on hover. */
export function Time({ date }: { date: Date | null | undefined }) {
  if (!date) return <span className="hint">Never</span>;
  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString("en-GB")}>
      {timeAgo(date)}
    </time>
  );
}

export function timeAgo(date: Date): string {
  const s = Math.round((Date.now() - date.getTime()) / 1000);
  const a = Math.abs(s);
  const v = a < 60 ? "just now" : a < 3600 ? `${Math.round(a / 60)}m` : a < 86400 ? `${Math.round(a / 3600)}h` : `${Math.round(a / 86400)}d`;
  if (v === "just now") return v;
  return s >= 0 ? `${v} ago` : `in ${v}`;
}
