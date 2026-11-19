/** Pure quality checks for AI-written emails (no database, easy to test). */

export const SPAM_WORDS = /\b(free|guarantee[d]?|act now|limited time|100%|risk[- ]free|click here|buy now|no obligation)\b/i;

/** Quality checks on a draft. Returns a list of problems (empty = OK). */
export function lintEmail(body: string, maxWords = 130): string[] {
  const issues: string[] = [];
  const words = body.trim().split(/\s+/).length;
  if (words > maxWords * 1.2) issues.push(`too long (${words} words, max ${maxWords})`);
  if (/\[[^\]]{2,30}\]|\{\{|\}\}|<[A-Z_ ]+>/.test(body)) issues.push("contains a placeholder");
  if (SPAM_WORDS.test(body)) issues.push(`contains spam trigger "${body.match(SPAM_WORDS)![0]}"`);
  if (/hope (this|you).{0,20}(finds|well)/i.test(body)) issues.push("generic opener");
  if (/[\u{1F300}-\u{1FAFF}]/u.test(body)) issues.push("contains emoji");
  return issues;
}
