# VEIL — E-commerce (Next.js + Stripe)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with a custom, Shopify-style single-page checkout that
charges cards via Stripe.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build settings to change.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables), then redeploy:

   | Name | Value |
   |------|-------|
   | `STRIPE_SECRET_KEY` | from Stripe Dashboard → Developers → API keys |
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | from the same page |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` |

The site builds and renders fully without Stripe configured — only the
final **Pay now** button on `/checkout` needs it. Use the test-mode keys
(`sk_test_...` / `pk_test_...`) while building; switch to live-mode keys only
once you're ready to take real charges. See `DEPLOYMENT.md` for the full
walkthrough.

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
- `pages/checkout.jsx` — custom single-page checkout (contact, delivery, payment via Stripe Elements, order summary)
- `pages/success.jsx` — post-checkout thank-you
- `pages/api/create-payment-intent.js` — creates a Stripe PaymentIntent for the cart total
- `lib/stripe.js` — server-side Stripe client
- `lib/stripeClient.js` — client-side Stripe.js loader
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart Context provider, persisted to `localStorage` so it survives navigating to `/checkout`
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Card details are collected via Stripe's own hosted Elements UI and never
  touch our server — PCI scope stays minimal.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
