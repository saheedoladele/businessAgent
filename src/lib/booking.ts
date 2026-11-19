import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure helpers for booking webhooks (Cal.com and Calendly): verify the
 * signature and turn each provider's payload into one common shape.
 */

export interface BookingEvent {
  provider: "calcom" | "calendly";
  kind: "created" | "cancelled" | "ignored";
  externalId: string;
  attendeeEmail: string;
  attendeeName?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  joinUrl?: string | null;
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Cal.com: X-Cal-Signature-256 = hex HMAC-SHA256 of the raw body. */
export function verifyCalcomSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature.trim());
}

/**
 * Calendly: Calendly-Webhook-Signature = "t=<unix>,v1=<hex>", where the
 * HMAC covers "<t>.<rawBody>". Old timestamps are rejected (replay protection).
 */
export function verifyCalendlySignature(
  rawBody: string,
  header: string | null,
  signingKey: string,
  toleranceSec = 300,
  nowSec = Math.floor(Date.now() / 1000),
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac("sha256", signingKey).update(`${t}.${rawBody}`).digest("hex");
  return safeEqualHex(expected, parts.v1);
}

export function parseCalcom(body: any): BookingEvent | null {
  const p = body?.payload;
  const attendee = p?.attendees?.[0];
  const email = (attendee?.email ?? p?.responses?.email?.value ?? "").toLowerCase();
  if (!p?.uid || !email || !p?.startTime) return null;

  const kind: BookingEvent["kind"] =
    body.triggerEvent === "BOOKING_CREATED" || body.triggerEvent === "BOOKING_RESCHEDULED"
      ? "created"
      : body.triggerEvent === "BOOKING_CANCELLED"
        ? "cancelled"
        : "ignored";
  const location = typeof p.location === "string" && /^https?:\/\//.test(p.location) ? p.location : null;
  return {
    provider: "calcom",
    kind,
    externalId: `calcom:${p.uid}`,
    attendeeEmail: email,
    attendeeName: attendee?.name ?? null,
    startsAt: new Date(p.startTime),
    endsAt: p.endTime ? new Date(p.endTime) : null,
    joinUrl: p.metadata?.videoCallUrl ?? location,
  };
}

export function parseCalendly(body: any): BookingEvent | null {
  const p = body?.payload;
  const ev = p?.scheduled_event;
  const email = (p?.email ?? "").toLowerCase();
  if (!p?.uri || !email || !ev?.start_time) return null;

  let kind: BookingEvent["kind"] = "ignored";
  if (body.event === "invitee.created") kind = "created";
  // A reschedule sends "canceled" (rescheduled: true) followed by a new "created": ignore the cancel.
  if (body.event === "invitee.canceled") kind = p.rescheduled ? "ignored" : "cancelled";

  return {
    provider: "calendly",
    kind,
    externalId: `calendly:${p.uri}`,
    attendeeEmail: email,
    attendeeName: p.name ?? null,
    startsAt: new Date(ev.start_time),
    endsAt: ev.end_time ? new Date(ev.end_time) : null,
    joinUrl: ev.location?.join_url ?? null,
  };
}
