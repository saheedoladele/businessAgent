/**
 * Check your SMTP settings by sending a test email to yourself.
 *   npm run smtp:test -- you@example.com
 */
import { transport } from "@/lib/mailer";

async function main() {
  const [to] = process.argv.slice(2);
  if (!to) throw new Error("Usage: npm run smtp:test -- you@example.com");
  await transport().verify();
  console.log("SMTP login OK");
  const info = await transport().sendMail({
    from: process.env.SMTP_USER,
    to,
    subject: "LeadHunter SMTP test",
    text: "If you can read this, LeadHunter can send email.",
  });
  console.log(`Test email sent: ${info.messageId}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
