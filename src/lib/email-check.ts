import { promises as dns } from "node:dns";

/**
 * Cheap deliverability check: does the email's domain have mail servers?
 * Catches typos and dead domains so we don't bounce (bounces hurt your
 * sender reputation). It does not prove the mailbox itself exists.
 */
export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const mx = await dns.resolveMx(domain);
    // A "null MX" (RFC 7505) means the domain explicitly accepts no mail.
    return mx.some((r) => r.exchange && r.exchange !== ".");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENODATA" || code === "ENOTFOUND") {
      // No MX record: mail falls back to the A record (RFC 5321).
      try {
        return (await dns.resolve4(domain)).length > 0;
      } catch {
        return false;
      }
    }
    // Temporary DNS trouble: don't throw the lead away.
    return true;
  }
}

export function isValidEmailSyntax(email: string): boolean {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/i.test(email);
}
