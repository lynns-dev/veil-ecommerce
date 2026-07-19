# VEIL — E-commerce (Next.js + Bankful)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with a custom, Shopify-style single-page checkout: card
details are entered right on `/checkout` and charged directly through
Bankful's Payment Service API — no redirect off-site.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build settings to change.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables), then redeploy:

   | Name | Value |
   |------|-------|
   | `BANKFUL_USERNAME` / `BANKFUL_PASSWORD` | your Bankful merchant credentials |
   | `BANKFUL_ENVIRONMENT` | `sandbox` or `live` — picks the default Bankful API host |
   | `BANKFUL_BASE_URL` | optional — overrides the host `BANKFUL_ENVIRONMENT` picks, if Bankful support gives you a different one for your account |
   | `STRIPE_SECRET_KEY` | optional — only needed to refund orders placed before the Bankful switch |
   | `QB_CLIENT_ID` / `QB_CLIENT_SECRET` | optional — only needed to refund orders placed before the Bankful switch |
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV / Upstash Redis store, used for admin sessions/reviews/discounts/analytics |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` |

The site builds and renders fully without Bankful configured — only the
final **Place order** button on `/checkout` needs it. A Bankful charge
completes synchronously in the same request (no webhook, no redirect) —
card fields are collected on `/checkout` and sent straight through to
Bankful from `pages/api/bankful-checkout.js`.

**PCI note**: because card details are entered directly on this site rather
than on a processor-hosted page, raw card data does pass through this app's
server for the duration of each charge request (never logged, never
stored). That generally puts this integration in PCI DSS SAQ D scope,
rather than the lighter SAQ A a redirect/hosted-page integration would get
— worth confirming your compliance obligations with Bankful/your acquirer
before taking real charges.

See `DEPLOYMENT.md` for the full walkthrough, including documentation
ambiguities worth confirming with Bankful support before going live
(sandbox vs. live host, and confirming decline/error field names against a
real sandbox transaction).

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
- `pages/api/bankful-checkout.js` — charges the card via Bankful's Payment Service API and fulfills the order directly (no webhook needed)
- `lib/bankfulServer.js` — Bankful charge/refund calls
- `lib/stripeServer.js` — kept for refunding legacy Stripe orders only; no longer used at checkout
- `pages/api/qb-auth/connect.js` / `callback.js` — one-time QuickBooks OAuth authorization, kept for refunding legacy QuickBooks orders only
- `lib/qbPaymentsServer.js`, `lib/qbServerAuth.js` / `qbTokenStore.js` — QuickBooks refund/token-refresh calls, kept for legacy orders only
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart Context provider, persisted to `localStorage` so it survives navigating to `/checkout`
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Card details are entered directly on `/checkout` and sent to Bankful from
  our own server — see the PCI note above.
- This integration has **not been tested against a live Bankful
  transaction** — Bankful's own documentation had a few inconsistencies
  (flagged in comments in `lib/bankfulServer.js`: sandbox vs. live host,
  and which response fields carry a decline reason for the Sale/Auth
  endpoints specifically, since that's only explicitly documented for the
  Cancel endpoint) that could only be resolved by testing against a real
  account. Run a real sandbox transaction — and a refund — before relying
  on this in production.
- Refunding orders placed under the old processors (Stripe, PayPal,
  QuickBooks) still works from the admin Orders tab; new orders always
  refund through Bankful.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
