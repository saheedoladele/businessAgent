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

## Booking webhooks (how the agent knows a meeting is booked)

The webhook must reach your app over the internet. Locally, expose it with a tunnel:
```bash
npx cloudflared tunnel --url http://localhost:3000   # or: ngrok http 3000
```
Use the printed https URL as `<APP_URL>` below.

**Cal.com** → Settings → Developer → Webhooks → New
- Subscriber URL: `<APP_URL>/api/webhooks/calcom`
- Events: Booking created, Booking rescheduled, Booking cancelled
- Secret: the value of `CALCOM_WEBHOOK_SECRET`

**Calendly** (paid plan) — create a subscription with your personal access token:
```bash
curl -X POST https://api.calendly.com/webhook_subscriptions \
  -H "Authorization: Bearer $CALENDLY_TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"<APP_URL>/api/webhooks/calendly","events":["invitee.created","invitee.canceled"],
       "organization":"<your org URI>","scope":"organization","signing_key":"<CALENDLY_WEBHOOK_SIGNING_KEY>"}'
```

Test without a real booking: `npm run dev`, then `npm run booking:test -- lead@company.com`.
