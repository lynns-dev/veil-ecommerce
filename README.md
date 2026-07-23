# VEIL — E-commerce (Next.js + Square)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with a custom, Shopify-style single-page checkout: card
details are tokenized client-side against Square's Web Payments SDK and
charged via the Square Payments API — the card number never touches our own
server.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build settings to change.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables), then redeploy:

   | Name | Value |
   |------|-------|
   | `SQUARE_ACCESS_TOKEN` / `SQUARE_LOCATION_ID` | from a Square Developer app (developer.squareup.com) |
   | `SQUARE_ENVIRONMENT` | `sandbox` or `production`, must match the token/location above |
   | `NEXT_PUBLIC_SQUARE_APPLICATION_ID` / `NEXT_PUBLIC_SQUARE_LOCATION_ID` | same app/location, exposed to the browser for the Web Payments SDK |
   | `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel KV / Upstash Redis store, used for admin sessions/reviews/discounts/analytics |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` |
   | `STRIPE_SECRET_KEY` / `QB_CLIENT_ID` / `QB_CLIENT_SECRET` / `QB_ENVIRONMENT` | optional — only needed to refund older Stripe/QuickBooks orders |

The site builds and renders fully without Square configured — only the
final **Place order** button on `/checkout` and `/offer3` needs it. See
`DEPLOYMENT.md` for the full walkthrough.

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
- `pages/offer3.jsx` — single-page ad-funnel checkout (product + shipping + payment together)
- `pages/success.jsx` — post-checkout thank-you
- `pages/api/square-checkout.js` — charges a Square card token and fulfills the order directly (no webhook needed)
- `lib/squareClient.js` — client-side card tokenization via Square's Web Payments SDK
- `lib/squareServer.js` — server-side Square charge/refund calls
- `lib/qbPaymentsServer.js` — kept for refunding older QuickBooks orders only; no longer used at checkout
- `lib/qbServerAuth.js` / `qbTokenStore.js` — QuickBooks access token refresh, persisted in KV (refunds only)
- `lib/stripeServer.js` — kept for refunding older Stripe orders only; no longer used at checkout
- `lib/bankfulServer.js` — an alternate checkout integration, not currently wired up to `/checkout` (see Notes below)
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart Context provider, persisted to `localStorage` so it survives navigating to `/checkout`
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Payment details are tokenized directly against Square's API from the
  browser — the server only ever sees a one-time card token, never raw
  card data.
- The Square Payments API integration (`lib/squareServer.js`) was built
  against Square's real Web Payments SDK docs for the client-side tokenize
  flow, but the server-side charge/refund request and response shapes are
  unverified against primary docs — see the comments at the top of that
  file. Treat the first real charge and refund as the actual verification
  step.
- A Bankful integration also exists in the codebase (`lib/bankfulServer.js`,
  plus a `bankful` branch in the admin refund route) but isn't currently
  wired up to `/checkout` — it returned a "merchant not configured, please
  contact Gateway" error from Bankful's own API that needs to be resolved
  with Bankful support before it can be used again.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
