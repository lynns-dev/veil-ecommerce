# VEIL — E-commerce (Next.js + QuickBooks Payments)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with a custom, Shopify-style single-page checkout that
charges cards via QuickBooks Payments.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build settings to change.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables), then redeploy:

   | Name | Value |
   |------|-------|
   | `QB_ACCESS_TOKEN` | OAuth access token from your Intuit Developer app (Payments enabled) |
   | `QB_ENVIRONMENT` | `sandbox` or `production` |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` |

The site builds and renders fully without a QuickBooks token — only the
final **Pay now** button on `/checkout` needs it. Add it when you're ready
to take payments. See `DEPLOYMENT.md` for the full QuickBooks setup walkthrough
(access tokens expire hourly and currently need manual rotation — flagged
there and in `pages/api/qb-checkout.js`).

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
- `pages/api/qb-checkout.js` — charges a card token via the QuickBooks Payments API
- `lib/qbPayments.js` — client-side card tokenization (Intuit Web Payments SDK)
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart Context provider, persisted to `localStorage` so it survives navigating to `/checkout`
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Confirm the tokenization call in `lib/qbPayments.js` against the current
  snippet in your Intuit app's Dashboard (Payments > Web Payments SDK) —
  Intuit has changed this SDK's method names across versions.
- QuickBooks access tokens expire (~60 min) and need a refresh-token exchange
  to renew; that auto-refresh isn't built yet, so `QB_ACCESS_TOKEN` needs
  manual rotation until it is.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
