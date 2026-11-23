/** Rules for trusting an email address that was found off the company website. */

const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|aol|proton(mail)?|zoho)\.[a-z.]+$/;

export function isFreeMail(email: string): boolean {
  return FREE_MAIL.test(email.split("@")[1] ?? "");
}

/**
 * Accept an address only if we can prove it's real:
 *  - it appears on the page it was said to come from, or
 *  - the page couldn't be loaded (e.g. Facebook) but it's on the company's own domain.
 * Free-mail addresses (Gmail etc.) must always be seen on the page, because
 * an AI could plausibly invent "acmeltd@gmail.com".
 */
export function acceptFoundEmail(
  email: string,
  leadDomain: string,
  pageEmails: string[] | null, // null = page could not be loaded
): boolean {
  const e = email.toLowerCase();
  if (pageEmails) return pageEmails.includes(e);
  const domain = e.split("@")[1] ?? "";
  return !isFreeMail(e) && (domain === leadDomain || domain.endsWith("." + leadDomain));
}
