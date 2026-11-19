import { z } from "zod";
import { askJSON } from "@/lib/ai";
import { db, logActivity } from "@/lib/db";
import { domainAcceptsMail, isValidEmailSyntax } from "@/lib/email-check";
import {
  extractEmails,
  extractPhones,
  fetchPage,
  findContactLinks,
  htmlToText,
  pickBestEmail,
} from "@/lib/scrape";

/**
 * Enrichment step: read the lead's website, collect public contact details,
 * and let Claude score how well they fit. Moves the lead from NEW to
 * QUALIFIED (ready for outreach) or DISQUALIFIED (with the reason in notes).
 */

const TEXT_PER_PAGE = 4000;

const ScoreSchema = z.object({
  fitScore: z.number().int().min(0).max(100),
  fitReason: z.string(),
  summary: z.string(),
  contactName: z.string().nullable().optional(),
  contactRole: z.string().nullable().optional(),
  painPoints: z.array(z.string()).default([]),
});

const SHAPE = `{
  "fitScore": 0-100 integer,
  "fitReason": "1-2 sentences: why they are or aren't a good prospect",
  "summary": "what the company does, 1-2 sentences",
  "contactName": "best decision maker named on the site, or null",
  "contactRole": "their role, or null",
  "painPoints": ["specific problems from the site that our services solve"]
}`;

export interface EnrichResult {
  status: "QUALIFIED" | "DISQUALIFIED";
  reason: string;
}

export async function enrichLead(leadId: string): Promise<EnrichResult> {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: leadId }, include: { business: true } });
  const b = lead.business;
  const homeUrl = lead.website ?? `https://${lead.domain}`;

  // 1. Read the homepage plus up to 3 contact/about/team pages.
  const pages = [];
  const home = await fetchPage(homeUrl);
  if (home) {
    pages.push(home);
    const extra = await Promise.all(findContactLinks(home.html, home.url).map((u) => fetchPage(u)));
    pages.push(...extra.filter((p) => p !== null));
  }

  // 2. Collect contact details from every page.
  const emails = new Set<string>(lead.email ? [lead.email] : []);
  const phones = new Set<string>(lead.phone ? [lead.phone] : []);
  for (const p of pages) {
    extractEmails(p.html).forEach((e) => emails.add(e));
    extractPhones(p.html).forEach((ph) => phones.add(ph));
  }

  // 3. Let Claude judge fit from what the site actually says.
  const siteText = pages
    .map((p) => `### ${p.url}\n${htmlToText(p.html).slice(0, TEXT_PER_PAGE)}`)
    .join("\n\n");

  const score = await askJSON(
    ScoreSchema,
    `Score how good a prospect this company is for the seller.

## Seller
${b.name}: ${b.description}
Services:
${b.services}
Ideal customer: ${b.idealCustomer}
${b.targetLocations ? `Target locations: ${b.targetLocations}` : ""}

## Prospect
Company: ${lead.companyName} (${lead.domain})
Location: ${lead.location ?? "unknown"}
Discovery notes: ${lead.fitReason ?? "none"}

## Their website
${siteText || "(website could not be loaded; judge from the notes only and score conservatively)"}

Scoring guide: 80+ clear need and matches the ideal customer; 60-79 plausible fit;
below 60 weak fit, wrong industry/size/location, or out of business.
Only name a contact person who appears on the website text above.`,
    { shapeHint: SHAPE, maxTokens: 1500, temperature: 0 },
  );

  const contactName = lead.contactName ?? score.contactName ?? null;
  const contactRole = lead.contactRole ?? score.contactRole ?? null;

  // 4. Choose an email and make sure its domain can receive mail.
  const candidates = [...emails].filter(isValidEmailSyntax);
  const suppressed = await db.suppression.findMany({
    where: { value: { in: [...candidates, lead.domain] } },
    select: { value: true },
  });
  const blocked = new Set(suppressed.map((s) => s.value));
  const usable = blocked.has(lead.domain) ? [] : candidates.filter((e) => !blocked.has(e));

  let email = pickBestEmail(usable, lead.domain, contactName);
  let emailValid: boolean | null = null;
  if (email) {
    emailValid = await domainAcceptsMail(email);
    if (!emailValid) email = null;
  }

  // 5. Decide.
  let status: EnrichResult["status"] = "QUALIFIED";
  let reason = score.fitReason;
  if (blocked.has(lead.domain)) {
    status = "DISQUALIFIED";
    reason = "Domain is on the do-not-contact list";
  } else if (score.fitScore < b.minFitScore) {
    status = "DISQUALIFIED";
    reason = `Fit score ${score.fitScore} below ${b.minFitScore}: ${score.fitReason}`;
  } else if (!email) {
    status = "DISQUALIFIED";
    reason = phones.size
      ? "No usable email found (phone available for manual follow-up)"
      : "No public contact details found";
  }

  const notes = [
    score.summary,
    score.painPoints.length ? `Pain points: ${score.painPoints.join("; ")}` : "",
    status === "DISQUALIFIED" ? `Disqualified: ${reason}` : "",
    emails.size > 1 ? `Other emails: ${[...emails].filter((e) => e !== email).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  await db.lead.update({
    where: { id: lead.id },
    data: {
      status,
      email,
      emailValid,
      phone: lead.phone ?? [...phones][0] ?? null,
      contactName,
      contactRole,
      description: lead.description ?? score.summary,
      fitScore: score.fitScore,
      fitReason: score.fitReason,
      notes,
    },
  });

  await logActivity(
    b.id,
    status === "QUALIFIED" ? "lead.qualified" : "lead.disqualified",
    `${lead.companyName}: ${status === "QUALIFIED" ? `score ${score.fitScore}, ${email}` : reason}`,
    lead.id,
  );
  return { status, reason };
}
