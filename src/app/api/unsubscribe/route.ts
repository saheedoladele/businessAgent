import { unsubscribeLead } from "@/agent/suppress";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * GET  shows a confirm button (so email security scanners that "click"
 *      every link don't unsubscribe people by accident).
 * POST performs the unsubscribe: used by the button and by Gmail/Yahoo
 *      one-click unsubscribe (List-Unsubscribe-Post).
 */

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 20px;color:#222}
button{background:#111;color:#fff;border:0;padding:12px 20px;border-radius:6px;font-size:16px;cursor:pointer}</style>
</head><body>${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!verifyUnsubscribeToken(token)) return page("Invalid link", "<h2>This link is invalid or expired.</h2>", 400);
  const safe = token.replace(/[^A-Za-z0-9._-]/g, "");
  return page(
    "Unsubscribe",
    `<h2>Stop receiving these emails?</h2>
     <form method="post" action="/api/unsubscribe?token=${safe}"><button type="submit">Unsubscribe</button></form>`,
  );
}

export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const leadId = verifyUnsubscribeToken(token);
  if (!leadId) return page("Invalid link", "<h2>This link is invalid or expired.</h2>", 400);
  await unsubscribeLead(leadId, "unsubscribe link");
  return page("Unsubscribed", "<h2>You're unsubscribed.</h2><p>You won't hear from us again.</p>");
}
