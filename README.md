# VEIL — E-commerce (Next.js + Stripe + QuickBooks Payments)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with a custom, Shopify-style single-page checkout: a
QuickBooks Payments card form up front, and a Stripe Payment Element below
it for everything else — Klarna, Afterpay/Clearpay, Link, Amazon Pay,
PayPal, and Cash App Pay, gated by whatever's enabled in the Stripe
Dashboard. No toggle — whichever one the shopper actually fills in and
submits is what gets charged.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build settings to change.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables), then redeploy:

   | Name | Value |
   |------|-------|
   | `STRIPE_SECRET_KEY` | from Stripe Dashboard → Developers → API keys |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | same page — the publishable key from the same mode (test/live) as the secret key |
   | `STRIPE_WEBHOOK_SECRET` | from Developers → Webhooks → your endpoint (`/api/stripe/webhook`, subscribed to `payment_intent.succeeded`) → Signing secret |
   | `QB_CLIENT_ID` / `QB_CLIENT_SECRET` | optional — only if offering QuickBooks Payments too; from an Intuit Developer app with Payments enabled |
   | `QB_ENVIRONMENT` / `NEXT_PUBLIC_QB_ENVIRONMENT` | optional — both `sandbox` or both `production`, must match which `QB_CLIENT_ID`/`QB_CLIENT_SECRET` pair you're using |
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV / Upstash Redis store, used for admin sessions/reviews/discounts/analytics, pending Stripe orders awaiting webhook fulfillment, and the QuickBooks refresh token |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` |

The site builds and renders fully without Stripe configured — only the final
**Place order** button on `/checkout` needs it. Stripe's key prefix
(`sk_test_`/`pk_test_` vs `sk_live_`/`pk_live_`) determines sandbox vs live
mode directly, so just make sure both keys come from the same mode — there's
no separate environment flag to keep in sync. Test everything with test-mode
keys first. Stripe order fulfillment happens from the webhook, not the
checkout request itself — Afterpay/Amazon Pay/Klarna/PayPal redirect the
shopper off-site to pay, so a client-triggered call can't be relied on to
always fire; QuickBooks has no redirect step, so it fulfills directly from
`/api/qb-checkout` instead. If offering QuickBooks, visit `/api/qb-auth/connect`
once after deploying to authorize it — see `DEPLOYMENT.md` for the full
walkthrough, including the two non-obvious ways the QuickBooks Charges API
can fail even with a valid connection, and enabling each Stripe payment
method in the Stripe Dashboard (none are on by default).

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

## Structure

- `pages/index.jsx` — homepage (hero, honest-math, collection, new scent, reviews, notes, ritual, newsletter)
- `pages/shop.jsx` — full catalog grid
- `pages/product/[id].jsx` — product detail (static-generated per product)
- `pages/checkout.jsx` — custom single-page checkout (contact, delivery, payment, order summary)
- `pages/success.jsx` — post-checkout thank-you
- `pages/api/stripe/create-intent.js` — starts a PaymentIntent as soon as checkout is ready to show payment options
- `pages/api/stripe/update-intent.js` — attaches order details (items, shipping, attribution) right before submit
- `pages/api/stripe/webhook.js` — the only place that actually fulfills a Stripe order, on `payment_intent.succeeded`
- `lib/stripeClient.js` — loads Stripe.js in the browser (Payment Element, never sees raw payment data)
- `lib/stripeServer.js` — server-side Stripe SDK singleton
- `lib/stripePendingOrders.js` — KV-backed order details keyed by PaymentIntent id, for the webhook to fulfill from
- `pages/api/qb-checkout.js` — charges a QuickBooks card token and fulfills the order directly (no webhook needed)
- `pages/api/qb-auth/connect.js` / `callback.js` — one-time QuickBooks OAuth authorization
- `lib/qbPayments.js` — client-side card tokenization directly against Intuit's API
- `lib/qbPaymentsServer.js` — server-side QuickBooks charge/refund calls
- `lib/qbServerAuth.js` / `qbTokenStore.js` — QuickBooks access token refresh, persisted in KV
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart Context provider, persisted to `localStorage` so it survives navigating to `/checkout`
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Payment details are collected by a Stripe-hosted iframe (Payment Element)
  or tokenized directly against Intuit's API (QuickBooks) — the server only
  ever sees a PaymentIntent reference or a one-time card token, never raw
  card data either way.
- 3D Secure/SCA authentication is handled natively inside `confirmPayment()`
  — no separate code path needed per card issuer.
- Klarna/Afterpay/Link/Amazon Pay/PayPal/Cash App Pay each need to be
  individually enabled in the Stripe Dashboard (Settings → Payment methods)
  before they'll actually show up — see `DEPLOYMENT.md`.
- QuickBooks Payments is optional and off by default (no `QB_CLIENT_ID` set
  = the "Card" fields at checkout will fail with a clear error if someone
  tries to submit them) — this integration previously hit an unresolved 403
  on this site and hasn't been re-verified working since being restored;
  test a real sandbox charge before relying on it.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
