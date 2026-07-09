# VEIL — E-commerce (Next.js + Stripe)

Minimal black-and-white storefront for VEIL scented body powder. Next.js 14
(Pages Router) with Stripe Checkout.

## Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel, **Add New → Project** and import the repo. Framework preset:
   **Next.js** (auto-detected). No build settings to change.
3. Add these Environment Variables in Vercel (Project → Settings → Environment
   Variables), then redeploy:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | your Stripe publishable key (`pk_...`) |
   | `STRIPE_SECRET_KEY` | your Stripe secret key (`sk_...`) |
   | `NEXT_PUBLIC_BASE_URL` | your deployed URL, e.g. `https://veil.vercel.app` |

The site builds and renders fully without Stripe keys — only the final
**Checkout** button needs them. Add them when you're ready to take payments.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

## Structure

- `pages/index.jsx` — homepage (hero, honest-math, collection, reviews, notes, ritual, newsletter)
- `pages/shop.jsx` — full catalog grid
- `pages/product/[id].jsx` — product detail (static-generated per product)
- `pages/success.jsx` — post-checkout thank-you
- `pages/api/checkout.js` — Stripe Checkout session
- `lib/products.js` — product data (edit scents/prices here)
- `lib/theme.js` — design tokens (colors, fonts, shared styles)
- `lib/useCart.js` — cart state + checkout hook
- `components/` — Header, CartDrawer, ProductVisual

## Notes before launch

- Product visuals are CSS/SVG stand-ins. Add real photography by setting each
  product's `image` URL in `lib/products.js` and swapping `ProductVisual` for
  `next/image` in the cards.
- Ratings and reviews on the homepage/product pages are **placeholders**.
  Connect a verified-review app and display only real reviews before launch.
- Confirm scent names, notes, and prices in `lib/products.js` match your catalog.
