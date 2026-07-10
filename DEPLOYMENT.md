# VEIL Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that charges cards directly via Stripe (no Shopify, no hosted redirect). Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) that charges Stripe directly, using Stripe's hosted Elements UI for card entry
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)

---

## Step 1: Set Up Stripe

1. Go to https://dashboard.stripe.com and sign in (or create a free account).
2. In **Developers → API keys**, copy the **Publishable key** and **Secret key**. Use the test-mode keys (`pk_test_...` / `sk_test_...`) while building — Stripe's test mode works instantly, no approval process required.
3. These go in `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY` respectively (see Step 2 below).
4. That's it — no OAuth flow, no separate merchant activation step, no token refresh to manage. `pages/api/create-payment-intent.js` creates a PaymentIntent server-side using your secret key, and `pages/checkout.jsx` collects card details via Stripe Elements client-side (card numbers never touch our server).
5. When ready to take real charges, switch to the **live mode** keys from the same dashboard page and update the environment variables.

### Testing

Use any of [Stripe's test card numbers](https://docs.stripe.com/testing#cards) (e.g. `4242 4242 4242 4242`, any future expiry, any CVC) against the test-mode keys — no real charge occurs, and it appears in your Stripe Dashboard's test-mode payments list immediately.

---

## Step 2: Deploy to Vercel

### Option A: Quick Deploy (Recommended)

1. Go to https://vercel.com and sign up (or log in with GitHub)
2. Click "New Project" → "Import Git Repository"
3. Select this repo
4. Click "Deploy"
5. After deployment, go to "Settings" → "Environment Variables"
6. Add:
   - `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: from Step 1
   - `NEXT_PUBLIC_BASE_URL`: your Vercel domain (e.g., `https://veil-checkout.vercel.app`)
7. Redeploy by going to "Deployments" → last deployment → "Redeploy"

### Option B: Deploy via Git

1. Push this folder to a GitHub repo
2. Connect that repo to Vercel
3. Add environment variables (same as above)
4. Vercel auto-deploys every push

---

## Step 3: Connect Your Domain (Squarespace)

1. In Vercel, go to "Settings" → "Domains"
2. Click "Add Domain"
3. Enter the domain you want (e.g., `checkout.veilpuff.com`)
4. Vercel will show you nameservers or CNAME record to add
5. In Squarespace:
   - Go to Settings → Domains
   - Find your domain settings
   - Add the Vercel DNS records
   - Wait ~24 hours for DNS to propagate
6. Once DNS is live, Vercel will auto-generate an SSL certificate

---

## Step 4: Test the Checkout

1. Go to your deployed domain
2. Add a product to the cart and click "Checkout"
3. In test mode, use one of [Stripe's test cards](https://docs.stripe.com/testing#cards) (e.g. `4242 4242 4242 4242`)
4. Check your Stripe Dashboard (test mode) — the payment should appear immediately

---

## Customizing Products

All products live in `lib/products.js`.

To change them:
1. Edit `lib/products.js`
2. Update product names, prices, images, descriptions, scent notes
3. Push to GitHub (or redeploy to Vercel)
4. Changes go live automatically

---

## Site Structure

### Pages
- `/` — Homepage with hero, featured products, brand story
- `/shop` — Full product catalog
- `/product/[id]` — Individual product detail pages
- `/checkout` — Custom single-page checkout
- `/success` — Order confirmation page

### Components
- `Header.jsx` — Navigation, cart button, logo
- `CartDrawer.jsx` — Slide-in cart, links to `/checkout`
- Product data at `lib/products.js`

### Architecture
- **Frontend**: Next.js React app (all pages)
- **Cart state**: React Context (`lib/useCart.js`), persisted to `localStorage` so it survives navigation to `/checkout`
- **Backend**: Vercel serverless function at `/api/create-payment-intent` (creates a Stripe PaymentIntent for the cart total)
- **Payments**: Stripe — card details are collected via Stripe's hosted Elements UI in the browser, so raw card data never reaches our server
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `STRIPE_SECRET_KEY` lives only in Vercel's environment variables (never in code)
- Card numbers are entered directly into Stripe's Elements UI and sent straight to Stripe — the server only creates and later reads the status of a PaymentIntent, never touching raw card data
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"STRIPE_SECRET_KEY is not set" error:**
- Add `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel's environment variables and redeploy

**Payment fails with a card error:**
- Expected in test mode for certain [test card numbers](https://docs.stripe.com/testing#cards) designed to simulate declines — try `4242 4242 4242 4242` for a guaranteed success

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Next Steps

1. Deploy this to Vercel
2. Add `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test mode)
3. Test with a Stripe test card
4. Connect your domain
5. Switch to live-mode Stripe keys when ready to take real charges
