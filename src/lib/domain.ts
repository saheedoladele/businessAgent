/**
 * Domain helpers used to de-duplicate leads and skip sites that are not
 * the prospect's own website (social networks, directories, marketplaces).
 */

/** "https://www.Acme.co.uk/about?x=1" → "acme.co.uk". Returns null if unusable. */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  if (!s) return null;
  if (s.includes("@")) s = s.split("@").pop()!; // allow emails
  if (!/^[a-z]+:\/\//.test(s)) s = "http://" + s;
  try {
    const host = new URL(s).hostname.replace(/^www\d?\./, "").replace(/\.$/, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

/** Sites that list companies but are not the company itself. */
const NOT_A_COMPANY_SITE = [
  "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com", "tiktok.com",
  "youtube.com", "wikipedia.org", "google.com", "goo.gl", "bing.com", "medium.com",
  "yelp.com", "yellowpages.com", "yell.com", "clutch.co", "goodfirms.co", "crunchbase.com",
  "glassdoor.com", "indeed.com", "upwork.com", "fiverr.com", "trustpilot.com",
  "tripadvisor.com", "bbb.org", "zoominfo.com", "apollo.io", "businesslist.com.ng",
  "vconnect.com", "finelib.com", "nairaland.com", "companieshouse.gov.uk",
  "find-and-update.company-information.service.gov.uk", "opencorporates.com",
];

export function isDirectoryDomain(domain: string): boolean {
  return NOT_A_COMPANY_SITE.some((d) => domain === d || domain.endsWith("." + d));
}
