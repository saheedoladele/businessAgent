/**
 * Create a sample business so you can test the agent before the dashboard exists.
 * Edit the values below, then: npm run seed
 */
import { db } from "@/lib/db";

async function main() {
  const business = await db.business.create({
    data: {
      name: "SaheedTech Studio",
      description:
        "A small software studio that builds custom web apps, dashboards and automations for small and medium-sized businesses.",
      services: [
        "Custom web applications (Next.js / Node)",
        "Business dashboards and internal tools",
        "Payment and API integrations",
        "Website redesign and performance fixes",
      ].join("\n"),
      website: "https://example.com",
      idealCustomer:
        "Small and medium businesses (10-200 staff) in logistics, retail, schools or healthcare that still run on spreadsheets, have an outdated website, or are hiring for developers.",
      targetLocations: "Lagos, Nigeria; Abuja, Nigeria",
      bookingUrl: "https://cal.com/your-handle/intro",
      senderName: "Saheed",
      senderEmail: "saheed@example.com",
      physicalAddress: "Your business address, Lagos, Nigeria",
    },
  });
  console.log(`Created business ${business.name}\nID: ${business.id}`);
}

main().finally(() => db.$disconnect());
