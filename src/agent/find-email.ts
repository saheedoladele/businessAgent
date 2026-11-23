import { z } from "zod";
import { askJSON } from "@/lib/ai";
import { acceptFoundEmail } from "@/lib/found-email";
import { hunterConfigured, hunterDomainSearch, pickHunterEmail } from "@/lib/hunter";
import { extractEmails, extractPhones, fetchPage } from "@/lib/scrape";

/**
 * Fallback when the company's website shows no email address:
 *   1. Hunter.io domain search (if HUNTER_API_KEY is set): fast, precise
 *   2. Claude web search: Google Business listing, Facebook/Instagram
 *      "About", directories, press. Every address must be verified.
 * Never guesses patterns like firstname@domain: guesses bounce.
 */

export interface FoundContact {
  email: string | null;
  source: string | null; // where it was found
  contactName?: string | null;
  contactRole?: string | null;
  phones: string[];
}

const SearchSchema = z.object({
  candidates: z
    .array(
      z.object({
        email: z.string(),
        sourceUrl: z.string(),
        contactName: z.string().nullable().optional(),
        contactRole: z.string().nullable().optional(),
      }),
    )
    .default([]),
  phones: z.array(z.string()).default([]),
});

export async function findEmailOffSite(lead: {
  companyName: string;
  domain: string;
  location: string | null;
  contactName: string | null;
}): Promise<FoundContact> {
  // 1. Hunter.io
  if (hunterConfigured()) {
    try {
      const best = pickHunterEmail(await hunterDomainSearch(lead.domain));
      if (best) {
        const name = [best.first_name, best.last_name].filter(Boolean).join(" ") || null;
        return {
          email: best.value.toLowerCase(),
          source: "hunter.io",
          contactName: name,
          contactRole: best.position ?? null,
          phones: [],
        };
      }
    } catch (err) {
      console.warn(`Hunter lookup failed for ${lead.domain}: ${(err as Error).message}`);
    }
  }

  // 2. Claude web search
  const result = await askJSON(
    SearchSchema,
    `Find a published business email address for this company.

Company: ${lead.companyName}
Website: ${lead.domain}
Location: ${lead.location ?? "unknown"}
${lead.contactName ? `Known contact: ${lead.contactName}` : ""}

Search places small businesses list contact details: their Google Business profile,
Facebook or Instagram "About"/contact info, LinkedIn company page, business directories,
chamber of commerce listings, news articles or press releases.

Rules:
- Only return an email address you actually saw written on a page, with that page's URL.
- Never construct or guess an address (no "info@${lead.domain}" unless you saw it).
- Prefer an owner/manager's address, then sales/info/hello.
- Also list any business phone or WhatsApp numbers you saw.
- If you find nothing, return empty lists.`,
    {
      webSearch: 4,
      maxTokens: 2000,
      shapeHint: `{ "candidates": [{ "email": "...", "sourceUrl": "https://...", "contactName": null, "contactRole": null }], "phones": ["+234..."] }`,
    },
  );

  // Verify each candidate against its source page before trusting it.
  for (const c of result.candidates) {
    const email = c.email.trim().toLowerCase();
    const page = /^https?:\/\//.test(c.sourceUrl) ? await fetchPage(c.sourceUrl) : null;
    const pageEmails = page ? extractEmails(page.html) : null;
    if (acceptFoundEmail(email, lead.domain, pageEmails)) {
      return {
        email,
        source: c.sourceUrl,
        contactName: c.contactName ?? null,
        contactRole: c.contactRole ?? null,
        phones: [...result.phones, ...(page ? extractPhones(page.html) : [])],
      };
    }
  }
  return { email: null, source: null, phones: result.phones };
}
