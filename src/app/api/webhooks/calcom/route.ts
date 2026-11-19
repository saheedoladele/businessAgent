import { recordBooking } from "@/agent/booking";
import { parseCalcom, verifyCalcomSignature } from "@/lib/booking";

/**
 * Cal.com webhook. In Cal.com: Settings → Developer → Webhooks → New
 *   URL: <APP_URL>/api/webhooks/calcom
 *   Events: Booking created, Booking rescheduled, Booking cancelled
 *   Secret: same value as CALCOM_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  const secret = process.env.CALCOM_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "CALCOM_WEBHOOK_SECRET not set" }, { status: 500 });

  const raw = await req.text(); // signature is computed over the exact raw body
  if (!verifyCalcomSignature(raw, req.headers.get("x-cal-signature-256"), secret)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const event = parseCalcom(body);
  if (!event) return Response.json({ ok: true, ignored: true }); // e.g. Cal.com's "ping" test

  return Response.json({ ok: true, ...(await recordBooking(event)) });
}
