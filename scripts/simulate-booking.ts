/**
 * Pretend a lead booked through Cal.com, to test the webhook locally
 * (start the app first with `npm run dev`).
 *   npm run booking:test -- lead@company.com
 *   npm run booking:test -- lead@company.com cancel
 */
import { createHmac } from "node:crypto";

async function main() {
  const [email, mode] = process.argv.slice(2);
  if (!email) throw new Error("Usage: npm run booking:test -- <lead email> [cancel]");
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) throw new Error("Set CALCOM_WEBHOOK_SECRET in .env");

  const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const body = JSON.stringify({
    triggerEvent: mode === "cancel" ? "BOOKING_CANCELLED" : "BOOKING_CREATED",
    payload: {
      uid: `test-${email}`,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      attendees: [{ email, name: "Test Attendee" }],
      metadata: { videoCallUrl: "https://meet.example.com/test" },
    },
  });
  const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/webhooks/calcom`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-cal-signature-256": createHmac("sha256", secret).update(body).digest("hex"),
    },
    body,
  });
  console.log(res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
