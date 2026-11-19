import { recordBooking } from "@/agent/booking";
import { parseCalendly, verifyCalendlySignature } from "@/lib/booking";

/**
 * Calendly webhook (needs a paid Calendly plan). Create the subscription via
 * Calendly's API with events invitee.created + invitee.canceled, the URL
 * <APP_URL>/api/webhooks/calendly and a signing_key equal to
 * CALENDLY_WEBHOOK_SIGNING_KEY. See README for the curl command.
 */
export async function POST(req: Request) {
  const key = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!key) return Response.json({ error: "CALENDLY_WEBHOOK_SIGNING_KEY not set" }, { status: 500 });

  const raw = await req.text();
  if (!verifyCalendlySignature(raw, req.headers.get("calendly-webhook-signature"), key)) {
    return Response.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const event = parseCalendly(body);
  if (!event) return Response.json({ ok: true, ignored: true });

  return Response.json({ ok: true, ...(await recordBooking(event)) });
}
