import { z } from "zod";

/**
 * Validation for the business setup form (pure, testable).
 * Turns raw form fields into data ready for db.business.create/update.
 */

const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .pipe(z.union([z.literal(""), z.url("Must be a valid URL")]))
  .transform((v) => v || null);

export const BusinessInput = z.object({
  name: z.string().trim().min(2, "Business name is required"),
  description: z.string().trim().min(20, "Describe the business in at least a sentence or two"),
  services: z.string().trim().min(3, "List at least one service"),
  website: optionalUrl,
  idealCustomer: z.string().trim().min(20, "Describe your ideal customer (industry, size, problems)"),
  targetLocations: z.string().trim().transform((v) => v || null),
  bookingUrl: optionalUrl,
  senderName: z.string().trim().min(2, "Sender name is required"),
  senderEmail: z.email("Sender email must be a valid email").trim().toLowerCase(),
  physicalAddress: z.string().trim().transform((v) => v || null),
  dailySendLimit: z.coerce.number().int().min(1).max(500),
  minFitScore: z.coerce.number().int().min(0).max(100),
  followUpDays: z
    .string()
    .trim()
    .transform((v) => (v ? v.split(/[\s,]+/).map(Number) : []))
    .pipe(z.array(z.number().int().min(1).max(60)).max(6, "At most 6 follow-ups")),
  requireApproval: z.boolean(),
  autoDiscover: z.boolean(),
});

export type BusinessData = z.infer<typeof BusinessInput>;

/** Parse a submitted form. Returns data or a single readable error message. */
export function parseBusinessForm(form: FormData): { data: BusinessData } | { error: string } {
  const raw = Object.fromEntries(
    ["name", "description", "services", "website", "idealCustomer", "targetLocations", "bookingUrl",
      "senderName", "senderEmail", "physicalAddress", "dailySendLimit", "minFitScore", "followUpDays",
    ].map((k) => [k, String(form.get(k) ?? "")]),
  );
  const parsed = BusinessInput.safeParse({
    ...raw,
    requireApproval: form.get("requireApproval") === "on",
    autoDiscover: form.get("autoDiscover") === "on",
  });
  if (parsed.success) return { data: parsed.data };
  const issue = parsed.error.issues[0];
  return { error: `${issue.path.join(".") || "form"}: ${issue.message}` };
}
