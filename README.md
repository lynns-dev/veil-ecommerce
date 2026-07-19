# VEIL — E-commerce (Next.js + QuickBooks Payments)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with a custom, Shopify-style single-page checkout: card
details are submitted to our own server and charged directly via the
QuickBooks Payments Charges API, so AVS/CVV verification runs at
authorization time (never stored, but does pass through the server — see
Notes below).

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build settings to change.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables), then redeploy:

   | Name | Value |
   |------|-------|
   | `QB_CLIENT_ID` / `QB_CLIENT_SECRET` | from an Intuit Developer app with Payments enabled |
   | `QB_ENVIRONMENT` | `sandbox` or `production`, must match which `QB_CLIENT_ID`/`QB_CLIENT_SECRET` pair you're using |
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV / Upstash Redis store, used for admin sessions/reviews/discounts/analytics, and the QuickBooks refresh token |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` |
   | `STRIPE_SECRET_KEY` | optional — only needed to refund older Stripe orders |

The site builds and renders fully without QuickBooks configured — only the
final **Place order** button on `/checkout` needs it. Visit
`/api/qb-auth/connect` once after deploying to authorize — see
`DEPLOYMENT.md` for the full walkthrough, including two non-obvious ways
the QuickBooks Charges API can fail even with a valid connection.

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
- `pages/api/qb-checkout.js` — charges a card directly via QuickBooks Payments and fulfills the order (no webhook needed)
- `pages/api/qb-auth/connect.js` / `callback.js` — one-time QuickBooks OAuth authorization
- `lib/qbPaymentsServer.js` — server-side QuickBooks charge/refund calls
- `lib/qbServerAuth.js` / `qbTokenStore.js` — QuickBooks access token refresh, persisted in KV
- `lib/stripeServer.js` — kept for refunding older Stripe orders only; no longer used at checkout
- `lib/bankfulServer.js` — an alternate checkout integration, not currently wired up to `/checkout` (see Notes below)
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart Context provider, persisted to `localStorage` so it survives navigating to `/checkout`
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Card details submitted at checkout pass through this app's server for
  the duration of the charge request (never logged or stored) before going
  to QuickBooks — this is a deliberate choice over tokenizing client-side,
  since a separate tokenize-then-charge-via-token flow returned every
  verification field (AVS, CVV) as N/A on real transactions and got
  auto-voided by Intuit's risk engine. This does put the site in PCI DSS
  SAQ D scope rather than the lighter SAQ A — worth confirming your actual
  compliance obligations with Intuit/your acquirer.
- QuickBooks Payments Charges API has two non-obvious failure modes even
  with a valid OAuth connection (a Development/Production credential
  mismatch, and requesting the accounting scope alongside the payment
  scope) — see `DEPLOYMENT.md` Step 1 before assuming something else is wrong.
- A Bankful integration also exists in the codebase (`lib/bankfulServer.js`,
  plus a `bankful` branch in the admin refund route) but isn't currently
  wired up to `/checkout` — it returned a "merchant not configured, please
  contact Gateway" error from Bankful's own API that needs to be resolved
  with Bankful support before it can be used again.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
