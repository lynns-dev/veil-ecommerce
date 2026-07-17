# VEIL Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that charges cards directly via Stripe (no Shopify, no hosted redirect). Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) with a Stripe Payment Element embedded inline — card, Afterpay/Clearpay, Amazon Pay, Apple Pay, and Link all show up in the same element automatically, no separate integration per method
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)

---

## Step 1: Set Up Stripe

1. Go to https://dashboard.stripe.com and sign in (or create a Stripe account).
2. Go to **Developers → API keys**. You'll see a **Publishable key** (`pk_test_...` or `pk_live_...`) and a **Secret key** (`sk_test_...` or `sk_live_...`).
3. Use the **test mode** keys first (toggle at the top of the dashboard) — these go in `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
4. When ready for real charges, switch the dashboard to **live mode** and swap both keys for their live-mode equivalents.

Unlike a lot of payment integrations, there's no separate "environment" setting to keep in sync — the key prefix (`sk_test_`/`pk_test_` vs `sk_live_`/`pk_live_`) *is* the environment. The one thing to get right: `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must come from the **same mode** (both test, or both live).

3D Secure / SCA (the "verify with your bank" popup some cards require) is handled automatically — no extra setup needed.

### Enable the extra payment methods

The checkout shows whichever methods are eligible *and* enabled for your account — none of these turn on by default:

- **Link**: Settings → Payment methods → toggle on. Usually instant.
- **Apple Pay**: Settings → Payment methods → toggle on, then add/verify your domain under that same section. Unlike some Apple Pay integrations, Stripe handles domain verification for you — no file to host yourself.
- **Afterpay/Clearpay**: Settings → Payment methods → toggle on. May require Stripe's approval depending on your account/region — check the status shown next to it.
- **Amazon Pay**: Settings → Payment methods → "Amazon Pay" → this is a bigger step than the others, it walks you through connecting (or creating) an actual Amazon Pay seller account through Stripe's flow, separate from your Stripe account itself.

Each method just needs to be turned on in the Dashboard — nothing in this codebase hardcodes which ones show up (`automatic_payment_methods` on the PaymentIntent lets Stripe decide based on what's enabled).

### Set up the webhook

Order fulfillment (recording the sale, notifying admins, analytics, the Meta Purchase event) runs from a webhook, not directly from checkout — Afterpay and Amazon Pay send the shopper off-site to pay, so a client-side "it worked" call can't be trusted to always fire.

1. Developers → Webhooks → **Add endpoint**.
2. Endpoint URL: `https://YOUR_DOMAIN/api/stripe/webhook`
3. Events to send: `payment_intent.succeeded`
4. After creating it, copy the **Signing secret** shown on that endpoint's page into `STRIPE_WEBHOOK_SECRET`.

Do this again (a second endpoint) if/when you switch to live mode — test-mode and live-mode webhooks are separate, each with their own signing secret.

---

## Step 2: Deploy to Vercel

### Option A: Quick Deploy (Recommended)

1. Go to https://vercel.com and sign up (or log in with GitHub)
2. Click "New Project" → "Import Git Repository"
3. Select this repo
4. Click "Deploy"
5. After deployment, go to "Settings" → "Environment Variables"
6. Add:
   - `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: from Step 1 (test-mode keys to start)
   - `STRIPE_WEBHOOK_SECRET`: from the webhook you registered in Step 1 — note the webhook URL needs your real deployed domain, so set this up *after* your first deploy, once you know the URL
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN`: from a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database — same REST API either way)
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
3. With test-mode keys, use one of Stripe's [test cards](https://docs.stripe.com/testing#cards) — e.g. `4242 4242 4242 4242`, any future expiry, any CVC, to test a 3D Secure challenge use `4000 0027 6000 3184`
4. Check your Stripe dashboard (Payments) — the charge should appear

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
- **Backend**: Vercel serverless functions at `/api/stripe/create-intent` (starts a PaymentIntent as soon as checkout is ready to show payment options), `/api/stripe/update-intent` (attaches order details right before submit), and `/api/stripe/webhook` (the only place that actually fulfills an order, on `payment_intent.succeeded`)
- **Payments**: Stripe Payment Element (`lib/stripeClient.js`) — a single Stripe-hosted iframe covering card, Afterpay/Clearpay, Amazon Pay, Apple Pay, and Link, so raw payment details never reach our own JS or server
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` live only in Vercel's environment variables (never in code)
- Payment details never reach our server or our own client-side JS — the Payment Element collects them directly into Stripe-controlled iframes, and the server only ever sees a PaymentIntent reference
- The webhook verifies Stripe's signature on every request (`stripe.webhooks.constructEvent`) before trusting it — an unsigned or forged request can't trigger fulfillment
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"STRIPE_SECRET_KEY is not set" error:**
- Add `STRIPE_SECRET_KEY` in Vercel's Environment Variables and redeploy

**Payment fails immediately with a generic error:**
- Confirm `STRIPE_SECRET_KEY` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are from the same mode (both `_test_` or both `_live_`) — a mismatch here is the most common cause

**Payment succeeds but no order shows up / admin wasn't notified:**
- The webhook likely isn't registered, or `STRIPE_WEBHOOK_SECRET` doesn't match — check Developers → Webhooks → your endpoint → recent deliveries for the actual error, and confirm the endpoint URL matches your real deployed domain exactly

**Afterpay/Amazon Pay/Apple Pay/Link don't show up in the Payment Element:**
- They need to be individually enabled in Settings → Payment methods (see Step 1) — being a valid Stripe account isn't enough on its own, and some (Afterpay, Amazon Pay) need additional approval/setup beyond just a toggle

**"KV_REST_API_URL / KV_REST_API_TOKEN are not set" error:**
- Provision a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database) and add its REST URL/token to your environment variables

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Next Steps

1. Deploy this to Vercel
2. Provision a KV store and add `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `KV_REST_API_URL` / `KV_REST_API_TOKEN` (test-mode Stripe keys to start — see Step 1)
3. Register the webhook (needs your real deployed URL — see Step 1) and add `STRIPE_WEBHOOK_SECRET`
4. Enable whichever of Link/Afterpay/Amazon Pay/Apple Pay you want to offer (see Step 1)
5. Test a full checkout with a Stripe test card
6. When ready for real charges, switch the Stripe dashboard to live mode, swap both Stripe keys for their live-mode equivalents, and register a second (live-mode) webhook
7. Connect your domain
