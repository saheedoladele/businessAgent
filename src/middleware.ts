import { NextResponse, type NextRequest } from "next/server";

/**
 * Password-protect the dashboard with HTTP Basic Auth when
 * DASHBOARD_PASSWORD is set. Webhooks and unsubscribe links stay public
 * (they're called by Cal.com/Calendly and by email recipients).
 */
const PUBLIC = [/^\/api\/webhooks\//, /^\/api\/unsubscribe/];

export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password || PUBLIC.some((re) => re.test(req.nextUrl.pathname))) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const [, pass] = atob(encoded).split(":");
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="LeadHunter"' },
  });
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
