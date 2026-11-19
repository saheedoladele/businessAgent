/**
 * Lightweight website reader: fetch a few public pages and pull out
 * readable text, emails, phone numbers and links to contact/about pages.
 * No headless browser: fast and cheap, good enough for most SMB sites.
 */

const USER_AGENT =
  "Mozilla/5.0 (compatible; LeadHunterBot/0.1; +https://github.com/) AppleWebKit/537.36 (KHTML, like Gecko)";
const MAX_BYTES = 1_500_000;

export interface Page {
  url: string;
  html: string;
}

/** Fetch an HTML page. Returns null on any failure (timeouts, non-HTML, 4xx/5xx). */
export async function fetchPage(url: string, timeoutMs = 12_000): Promise<Page | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") ?? "").includes("html")) return null;
    const html = (await res.text()).slice(0, MAX_BYTES);
    return { url: res.url || url, html };
  } catch {
    return null;
  }
}

/** Strip tags/scripts and collapse whitespace. */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#64;|&commat;/g, "@")
    .replace(/&#46;|&period;/g, ".");
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;
const JUNK_EMAIL =
  /\.(png|jpe?g|gif|svg|webp|css|js)$|@(example\.|domain\.|email\.|sentry|wixpress\.com|.*\.wix\.com)|^(noreply|no-reply|donotreply|user|name|your|you)@/i;

/** Emails found in mailto: links and visible text, cleaned and de-duplicated. */
export function extractEmails(html: string): string[] {
  const found = new Set<string>();
  const sources = [decodeEntities(html), htmlToText(html)];
  for (const src of sources) {
    for (const m of src.matchAll(EMAIL_RE)) {
      const e = m[0].toLowerCase().replace(/^mailto:/, "").replace(/\.+$/, "");
      if (!JUNK_EMAIL.test(e)) found.add(e);
    }
  }
  return [...found];
}

/** Phone numbers from tel: links (reliable) plus obvious international formats in text. */
export function extractPhones(html: string): string[] {
  const found = new Set<string>();
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const p = cleanPhone(decodeURIComponent(m[1]));
    if (p) found.add(p);
  }
  for (const m of htmlToText(html).matchAll(/\+\d[\d\s().-]{7,18}\d/g)) {
    const p = cleanPhone(m[0]);
    if (p) found.add(p);
  }
  return [...found];
}

function cleanPhone(raw: string): string | null {
  const p = raw.replace(/[^\d+]/g, "");
  const digits = p.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? p : null;
}

/** Same-site links that probably lead to contact / about / team pages. */
export function findContactLinks(html: string, baseUrl: string, limit = 3): string[] {
  const base = new URL(baseUrl);
  const scored: { url: string; score: number }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: URL;
    try {
      url = new URL(m[1], base);
    } catch {
      continue;
    }
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    const key = url.origin + url.pathname.replace(/\/$/, "");
    if (seen.has(key) || key === base.origin) continue;
    const label = (url.pathname + " " + m[2].replace(/<[^>]+>/g, "")).toLowerCase();
    const score = /contact/.test(label) ? 3 : /team|people|leadership/.test(label) ? 2 : /about/.test(label) ? 1 : 0;
    if (score) {
      seen.add(key);
      scored.push({ url: key, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.url);
}

const ROLE_PREFIX = /^(info|hello|hi|contact|enquir|inquir|sales|admin|office|team|business|support|help|mail)/;

/**
 * Pick the best address to cold-email: on the company's own domain,
 * a person (matching the contact name if we have one) beats a role inbox.
 */
export function pickBestEmail(emails: string[], domain: string, contactName?: string | null): string | null {
  const own = emails.filter((e) => {
    const d = e.split("@")[1];
    return d === domain || d.endsWith("." + domain);
  });
  const pool = own.length ? own : emails;
  if (!pool.length) return null;

  const first = contactName?.trim().split(/\s+/)[0]?.toLowerCase();
  const rank = (e: string) => {
    const local = e.split("@")[0];
    if (first && first.length > 1 && local.includes(first)) return 0;
    if (/^(sales|business|hello|info|contact|enquir|inquir)/.test(local)) return 2;
    if (!ROLE_PREFIX.test(local)) return 1; // probably a person
    return 3; // support/admin etc.
  };
  return [...pool].sort((a, b) => rank(a) - rank(b))[0];
}
