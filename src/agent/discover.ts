import { z } from "zod";
import { askJSON } from "@/lib/ai";
import { db, logActivity } from "@/lib/db";
import { isDirectoryDomain, normalizeDomain } from "@/lib/domain";

/**
 * Discovery step: Claude searches the web for companies that match the
 * business's ideal customer and we save new, unique ones as NEW leads.
 */

const LEADS_PER_RUN = 10;

const CandidateSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().min(3),
  description: z.string().optional().default(""),
  location: z.string().optional().nullable(),
  whyFit: z.string().optional().default(""),
  sourceUrl: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactRole: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
});
const ResultSchema = z.object({ leads: z.array(CandidateSchema) });

const SHAPE = `{
  "leads": [{
    "companyName": "string",
    "website": "the company's OWN website URL",
    "description": "what they do, 1-2 sentences",
    "location": "city, country or null",
    "whyFit": "why they likely need our services",
    "sourceUrl": "page where you found them",
    "contactName": "decision maker if found publicly, else null",
    "contactRole": "their title or null",
    "email": "business email if published on their site, else null",
    "phone": "business phone if published, else null"
  }]
}`;

const SYSTEM = `You are a B2B lead researcher. You find real, currently operating companies
that are a strong fit for a seller's services, using web search.
Rules:
- Only include companies you actually found in search results. Never invent companies, people, emails or phone numbers.
- "website" must be the company's own site, not a directory, marketplace or social profile.
- Prefer companies showing a clear signal they need the seller's services (hiring, outdated site, expansion, recent funding, complaints about a problem the seller solves).
- Only include contact details that are publicly published for business purposes.`;

/** Create a queued search run (the worker or a script executes it). */
export async function createSearchRun(businessId: string, query?: string) {
  return db.searchRun.create({ data: { businessId, query: query || null } });
}

/** Execute a search run end-to-end. Returns the number of new leads saved. */
export async function runDiscovery(searchRunId: string): Promise<number> {
  const run = await db.searchRun.update({
    where: { id: searchRunId },
    data: { status: "RUNNING" },
    include: { business: true },
  });
  const b = run.business;

  try {
    // Domains we must not return: already known leads, opt-outs, ourselves.
    const known = await db.lead.findMany({
      where: { businessId: b.id },
      select: { domain: true },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    const suppressed = await db.suppression.findMany({ select: { value: true } });
    const exclude = new Set<string>([
      ...known.map((l) => l.domain),
      ...suppressed.map((s) => s.value).filter((v) => !v.includes("@")),
    ]);
    const ownDomain = normalizeDomain(b.website);
    if (ownDomain) exclude.add(ownDomain);

    const prompt = `Find ${LEADS_PER_RUN} potential customers for this business.

## Seller
Name: ${b.name}
Website: ${b.website ?? "n/a"}
About: ${b.description}
Services:
${b.services}

## Ideal customer
${b.idealCustomer}
${b.targetLocations ? `Target locations: ${b.targetLocations}` : ""}
${run.query ? `\n## Extra instructions for this search\n${run.query}` : ""}

## Do NOT include these domains (already known)
${[...exclude].slice(0, 300).join(", ") || "(none)"}`;

    const result = await askJSON(ResultSchema, prompt, {
      system: SYSTEM,
      shapeHint: SHAPE,
      webSearch: 10,
      maxTokens: 8000,
    });

    let saved = 0;
    for (const c of result.leads) {
      const domain = normalizeDomain(c.website);
      if (!domain || exclude.has(domain) || isDirectoryDomain(domain)) continue;
      exclude.add(domain); // de-dupe within this batch too

      const email = c.email?.trim().toLowerCase() || null;
      const created = await db.lead.upsert({
        where: { businessId_domain: { businessId: b.id, domain } },
        update: {}, // never overwrite an existing lead
        create: {
          businessId: b.id,
          searchRunId: run.id,
          companyName: c.companyName.trim(),
          website: c.website.startsWith("http") ? c.website : `https://${domain}`,
          domain,
          description: c.description || null,
          location: c.location || null,
          sourceUrl: c.sourceUrl || null,
          contactName: c.contactName || null,
          contactRole: c.contactRole || null,
          email: email && email.includes("@") ? email : null,
          phone: c.phone || null,
          fitReason: c.whyFit || null,
        },
      });
      if (created.searchRunId === run.id) {
        saved++;
        await logActivity(b.id, "lead.found", `Found ${created.companyName} (${domain})`, created.id);
      }
    }

    await db.searchRun.update({
      where: { id: run.id },
      data: { status: "DONE", leadsFound: saved, finishedAt: new Date() },
    });
    await logActivity(b.id, "search.done", `Discovery found ${saved} new leads`);
    return saved;
  } catch (err) {
    await db.searchRun.update({
      where: { id: run.id },
      data: { status: "FAILED", error: (err as Error).message, finishedAt: new Date() },
    });
    await logActivity(b.id, "search.failed", `Discovery failed: ${(err as Error).message}`);
    throw err;
  }
}
