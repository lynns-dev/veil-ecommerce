# VEIL — E-commerce (Next.js + Stripe)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with a custom, Shopify-style single-page checkout built on a
Stripe Payment Element — card, Afterpay/Clearpay, Amazon Pay, Apple Pay, and
Link all show up in the same embedded element, gated by whatever's enabled
in the Stripe Dashboard.

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
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV / Upstash Redis store, used for admin sessions/reviews/discounts/analytics, and pending Stripe orders awaiting webhook fulfillment |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` |

The site builds and renders fully without Stripe configured — only the final
**Place order** button on `/checkout` needs it. Stripe's key prefix
(`sk_test_`/`pk_test_` vs `sk_live_`/`pk_live_`) determines sandbox vs live
mode directly, so just make sure both keys come from the same mode — there's
no separate environment flag to keep in sync. Test everything with test-mode
keys first. Order fulfillment happens from the webhook, not the checkout
request itself — Afterpay/Amazon Pay redirect the shopper off-site to pay,
so a client-triggered call can't be relied on to always fire. See
`DEPLOYMENT.md` for the full walkthrough, including enabling each payment
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
- `pages/api/stripe/webhook.js` — the only place that actually fulfills an order, on `payment_intent.succeeded`
- `lib/stripeClient.js` — loads Stripe.js in the browser (Payment Element, never sees raw payment data)
- `lib/stripeServer.js` — server-side Stripe SDK singleton
- `lib/stripePendingOrders.js` — KV-backed order details keyed by PaymentIntent id, for the webhook to fulfill from
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart Context provider, persisted to `localStorage` so it survives navigating to `/checkout`
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Payment details are collected by a Stripe-hosted iframe (Payment Element)
  — the server only ever sees a PaymentIntent reference, never raw card data.
- 3D Secure/SCA authentication is handled natively inside `confirmPayment()`
  — no separate code path needed per card issuer.
- Afterpay/Amazon Pay/Apple Pay/Link each need to be individually enabled in
  the Stripe Dashboard (Settings → Payment methods) before they'll actually
  show up — see `DEPLOYMENT.md`.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
