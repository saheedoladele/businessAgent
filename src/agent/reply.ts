import { askText } from "@/lib/ai";
import { db } from "@/lib/db";
import { lintEmail } from "@/lib/email-lint";

/**
 * Writes conversational replies once a prospect has answered:
 *  - BOOKING: they're interested → thank them and share the booking link
 *  - ANSWER:  they asked a question → answer briefly, then suggest a call
 *  - NUDGE:   interested but hasn't booked yet → gentle reminder
 */

export type ReplyPurpose = "BOOKING" | "ANSWER" | "NUDGE";

const BRIEF: Record<ReplyPurpose, string> = {
  BOOKING:
    "They are interested. Thank them in one line, suggest a short call, and share the booking link so they can pick a time. If there is no booking link, ask for two times that suit them this week.",
  ANSWER:
    "They asked a question. Answer it briefly and honestly using ONLY the seller information below. If the answer isn't in that information (e.g. exact pricing), say it depends on their needs and that a short call is the quickest way to give a real answer. Then share the booking link.",
  NUDGE:
    "They said they were interested but haven't booked a time. Send a short, friendly reminder with the booking link. One or two sentences, no guilt-tripping.",
};

const SYSTEM = `You are replying, as the seller, in an ongoing email conversation with a prospect.
Write like a real person: short, warm, specific, plain text, no markdown, no emojis, no placeholders.
Never invent prices, clients, results, availability or facts not given to you.
Sign off with the sender's first name. Output ONLY the email body.`;

export async function writeReply(leadId: string, purpose: ReplyPurpose) {
  const lead = await db.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { business: true, messages: { orderBy: { createdAt: "asc" } } },
  });
  const b = lead.business;

  const thread = lead.messages
    .filter((m) => m.status === "SENT" || m.status === "RECEIVED")
    .slice(-6)
    .map((m) => `--- ${m.direction === "OUTBOUND" ? `${b.senderName} wrote` : "They wrote"} ---\n${m.body}`)
    .join("\n\n");

  const prompt = `## Task
${BRIEF[purpose]}
Keep it under 90 words.

## Seller
${b.senderName} from ${b.name}${b.website ? ` (${b.website})` : ""}
About: ${b.description}
Services:
${b.services}
Booking link: ${b.bookingUrl ?? "(none)"}

## Prospect
${lead.contactName ?? "Unknown name"} at ${lead.companyName}

## Conversation so far (latest last)
${thread}`;

  let body = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    body = (await askText(prompt, { system: SYSTEM, maxTokens: 800, temperature: 0.5 })).trim();
    if (!lintEmail(body, 90).length) break;
    if (attempt === 1) throw new Error(`Reply failed quality checks: ${lintEmail(body, 90).join("; ")}`);
  }

  const lastInbound = [...lead.messages].reverse().find((m) => m.direction === "INBOUND");
  const firstOut = lead.messages.find((m) => m.direction === "OUTBOUND" && m.subject);
  const baseSubject = (lastInbound?.subject || firstOut?.subject || `${lead.companyName}`).replace(/^(re:\s*)+/i, "");
  return { subject: `Re: ${baseSubject}`, body };
}
