/**
 * Phone helpers. Numbers are stored in E.164 (+2348031234567) so they work
 * for dialling, WhatsApp links and voice APIs. Local numbers without a
 * country code use DEFAULT_COUNTRY_CODE (234 = Nigeria).
 */

export function toE164(raw: string, defaultCountryCode = process.env.DEFAULT_COUNTRY_CODE || "234"): string | null {
  let s = raw.trim().replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    // Local format: drop the trunk "0" (0803... → 803...) and add the country code.
    s = "+" + defaultCountryCode + s.replace(/^0+/, "");
  }
  const digits = s.slice(1);
  if (!/^\d{8,15}$/.test(digits)) return null;
  return s;
}

/** wa.me link that opens WhatsApp with the message ready to send. */
export function whatsappLink(e164: string, text: string): string {
  return `https://wa.me/${e164.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`;
}
