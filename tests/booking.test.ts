import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseCalcom, parseCalendly, verifyCalcomSignature, verifyCalendlySignature } from "../src/lib/booking";

const SECRET = "whsec_test_123";

test("verifies Cal.com signatures", () => {
  const raw = '{"triggerEvent":"BOOKING_CREATED"}';
  const sig = createHmac("sha256", SECRET).update(raw).digest("hex");
  assert.equal(verifyCalcomSignature(raw, sig, SECRET), true);
  assert.equal(verifyCalcomSignature(raw + " ", sig, SECRET), false);
  assert.equal(verifyCalcomSignature(raw, null, SECRET), false);
});

test("verifies Calendly signatures and rejects stale ones", () => {
  const raw = '{"event":"invitee.created"}';
  const t = 1_800_000_000;
  const v1 = createHmac("sha256", SECRET).update(`${t}.${raw}`).digest("hex");
  assert.equal(verifyCalendlySignature(raw, `t=${t},v1=${v1}`, SECRET, 300, t + 10), true);
  assert.equal(verifyCalendlySignature(raw, `t=${t},v1=${v1}`, SECRET, 300, t + 3600), false);
  assert.equal(verifyCalendlySignature(raw, `t=${t},v1=bad`, SECRET, 300, t), false);
});

test("parses Cal.com bookings and cancellations", () => {
  const body = {
    triggerEvent: "BOOKING_CREATED",
    payload: {
      uid: "abc",
      startTime: "2026-11-25T10:00:00Z",
      endTime: "2026-11-25T10:30:00Z",
      attendees: [{ email: "Ada@Acme.com", name: "Ada" }],
      metadata: { videoCallUrl: "https://meet.x/abc" },
    },
  };
  const ev = parseCalcom(body)!;
  assert.equal(ev.kind, "created");
  assert.equal(ev.externalId, "calcom:abc");
  assert.equal(ev.attendeeEmail, "ada@acme.com");
  assert.equal(ev.joinUrl, "https://meet.x/abc");
  assert.equal(parseCalcom({ ...body, triggerEvent: "BOOKING_CANCELLED" })!.kind, "cancelled");
  assert.equal(parseCalcom({ triggerEvent: "PING" }), null);
});

test("parses Calendly and ignores the cancel half of a reschedule", () => {
  const body = {
    event: "invitee.created",
    payload: {
      uri: "https://api.calendly.com/invitees/1",
      email: "tunde@shop.ng",
      name: "Tunde",
      rescheduled: false,
      scheduled_event: { start_time: "2026-11-26T09:00:00Z", end_time: "2026-11-26T09:30:00Z", location: { join_url: "https://zoom.us/j/1" } },
    },
  };
  assert.equal(parseCalendly(body)!.kind, "created");
  assert.equal(parseCalendly({ ...body, event: "invitee.canceled" })!.kind, "cancelled");
  assert.equal(parseCalendly({ event: "invitee.canceled", payload: { ...body.payload, rescheduled: true } })!.kind, "ignored");
});
