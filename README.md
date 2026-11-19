# LeadHunter

An AI agent that finds real, qualified customers for a business and works them until a meeting is booked.

1. **Set up** your business: description, services, website, ideal customer, booking link.
2. **Discover**: the agent searches the web for companies that match your ideal customer.
3. **Enrich & qualify**: it reads each prospect's website, pulls public contact details and scores fit.
4. **Reach out**: it writes a personalised email (you can review before it sends).
5. **Follow up**: a timed sequence keeps going until the prospect replies.
6. **Book**: replies are classified by AI; interested prospects get your booking link, and bookings (Cal.com / Calendly) close the loop.

## Stack
Next.js (dashboard + API) · Node worker · Postgres (Prisma) · Redis (BullMQ) · Claude API

## Getting started
```bash
cp .env.example .env        # fill in your keys
docker compose up -d        # Postgres + Redis
npm install
npm run dev                 # http://localhost:3000
```
