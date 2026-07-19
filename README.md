# VEIL — E-commerce (Next.js + Bankful)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with a custom, Shopify-style single-page checkout: the
shopper enters their address here, then is redirected to Bankful's own
Hosted Payment Page to enter their card. Raw card data never reaches this
app — the browser goes straight to Bankful for that part, then comes back.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build settings to change.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables), then redeploy:

   | Name | Value |
   |------|-------|
   | `BANKFUL_USERNAME` / `BANKFUL_PASSWORD` | your Bankful merchant credentials — `BANKFUL_PASSWORD` also signs every request/callback (HMAC-SHA256) |
   | `BANKFUL_ENVIRONMENT` | `sandbox` or `live` — picks the default Bankful API host |
   | `BANKFUL_BASE_URL` | optional — overrides the host `BANKFUL_ENVIRONMENT` picks, if Bankful support gives you a different one for your account |
   | `STRIPE_SECRET_KEY` | optional — only needed to refund orders placed before the Bankful switch |
   | `QB_CLIENT_ID` / `QB_CLIENT_SECRET` | optional — only needed to refund orders placed before the Bankful switch |
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV / Upstash Redis store, used for admin sessions/reviews/discounts/analytics and pending Bankful orders awaiting webhook confirmation |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` — Bankful redirects back here after payment |

The site builds and renders fully without Bankful configured — only the
final **Place order** button on `/checkout` needs it. Order fulfillment
happens from `/api/bankful-webhook`, not the checkout request itself —
Bankful's hosted page always redirects the shopper off-site to pay, so a
client-triggered call can't be relied on to always fire; register
`https://YOUR_DOMAIN/api/bankful-webhook` as the callback URL with Bankful
(already sent automatically as `url_callback` on every hosted-page request,
see `lib/bankfulServer.js`) so their async confirmation reaches it. See
`DEPLOYMENT.md` for the full walkthrough, including documentation
ambiguities worth confirming with Bankful support before going live
(sandbox vs. live host, and which refund mechanism their API actually
expects).

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
- `pages/success.jsx` — post-checkout thank-you (also handles Bankful's failed/pending redirect outcomes)
- `pages/api/bankful-checkout.js` — saves the pending order and starts a Bankful hosted-page payment
- `pages/api/bankful-webhook.js` — the only place that actually fulfills a Bankful order, on Bankful's signed async callback
- `lib/bankfulServer.js` — HMAC request signing, hosted-page payload building, callback verification, refunds
- `lib/bankfulPendingOrders.js` — KV-backed order details keyed by our own order id, for the webhook to fulfill from
- `lib/stripeServer.js` — kept for refunding legacy Stripe orders only; no longer used at checkout
- `pages/api/qb-auth/connect.js` / `callback.js` — one-time QuickBooks OAuth authorization, kept for refunding legacy QuickBooks orders only
- `lib/qbPaymentsServer.js`, `lib/qbServerAuth.js` / `qbTokenStore.js` — QuickBooks refund/token-refresh calls, kept for legacy orders only
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart Context provider, persisted to `localStorage` so it survives navigating to `/checkout`
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Card details are collected entirely on Bankful's own hosted page — this
  app never sees raw card data at any point.
- This integration has **not been tested against a live Bankful
  transaction** — Bankful's own documentation had a few inconsistencies
  (flagged in comments in `lib/bankfulServer.js`: sandbox vs. live host,
  a possibly-required field missing from their own example, and two
  differently-documented refund mechanisms) that could only be resolved by
  testing against a real account. Run a real sandbox transaction — and a
  refund — before relying on this in production.
- Refunding orders placed under the old processors (Stripe, PayPal,
  QuickBooks) still works from the admin Orders tab; new orders always
  refund through Bankful.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
