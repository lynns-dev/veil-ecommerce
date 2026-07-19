# VEIL Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that redirects to Bankful's Hosted Payment Page to take the card (no Shopify). Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) — shopper enters contact/shipping details here, then **Place order** redirects to Bankful's own hosted page to enter their card and redirects back afterward
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)

---

## Step 1: Set Up Bankful

1. Get your Bankful merchant credentials (username/password) from Bankful — these go in `BANKFUL_USERNAME` / `BANKFUL_PASSWORD`.
2. Set `BANKFUL_ENVIRONMENT` to `sandbox` while testing, `live` once you're ready for real charges.
3. Ask Bankful support to confirm which API host your sandbox and live credentials actually work against, and set `BANKFUL_BASE_URL` explicitly if it differs from the default this codebase picks based on `BANKFUL_ENVIRONMENT`. **This matters** — Bankful's own documentation lists `api-dev1.bankfulportal.com` as the sandbox host, but its curl examples (even ones using sandbox credentials) target `api.paybybankful.com`. That inconsistency was never resolved during this integration; don't assume the default in `lib/bankfulServer.js` is correct without confirming.
4. Register `https://YOUR_DOMAIN/api/bankful-webhook` with Bankful as your callback URL, if they require registering it separately from what's sent per-request — this codebase already sends it automatically as `url_callback` on every hosted-page request, so this may not be a separate step depending on how Bankful's account is set up. Confirm with Bankful support either way, since this webhook is the **only** thing that actually fulfills an order (see below).

### How the payment flow works

1. Shopper fills in contact/shipping info on `/checkout` and clicks **Place order**.
2. `/api/bankful-checkout` saves the order details (cart, email, shipping) in the KV store keyed by a generated order id, builds a signed request, and asks Bankful for a hosted-page URL.
3. The browser is redirected to that URL — Bankful's own page, where the shopper enters their card. Raw card data never touches this app.
4. Bankful redirects the shopper back to `/success` (or `/success?status=failed` / `/success?status=pending` / `/checkout` for cancel), **and independently** sends a signed async callback to `/api/bankful-webhook`.
5. Only that webhook — after verifying Bankful's HMAC-SHA256 signature — actually fulfills the order (records the sale, notifies admins, fires the Meta Purchase event). The shopper's browser redirect is cosmetic only; it can't be trusted to fire fulfillment, since Bankful's docs explicitly warn a shopper can close the tab or lose connection before making it back.

### ⚠️ Things worth confirming with Bankful support before relying on this in production

This integration was built entirely from Bankful's own pasted documentation, without access to a live account to test against. A few inconsistencies in that documentation were resolved with a best guess, documented in comments in `lib/bankfulServer.js`, and should be verified for real before launch:

1. **Sandbox vs. live base URL** — see above.
2. **The `transaction_type` field** — Bankful's hosted-page parameter table lists it as required, but their own curl example for the same endpoint omits it. This codebase sends `transaction_type: 'CAPTURE'`; confirm that's correct.
3. **Which refund mechanism Bankful's hosted-page transactions actually expect** — Bankful's docs describe two different-looking refund flows in different sections: `transaction_type=REFUND` against the direct transaction API, and `request_action=CCCREDIT` against the same endpoint under a section explicitly titled "Refund Hosted." This codebase uses `CCCREDIT` (`lib/bankfulServer.js`'s `refundHostedTransaction`) since it's the one paired with hosted-page transactions specifically — but this hasn't been tested against a real refund.

Run a real sandbox transaction, and a refund of that transaction, before taking this live.

---

## Step 2: Deploy to Vercel

### Option A: Quick Deploy (Recommended)

1. Go to https://vercel.com and sign up (or log in with GitHub)
2. Click "New Project" → "Import Git Repository"
3. Select this repo
4. Click "Deploy"
5. After deployment, go to "Settings" → "Environment Variables"
6. Add:
   - `BANKFUL_USERNAME` / `BANKFUL_PASSWORD`: from Step 1
   - `BANKFUL_ENVIRONMENT`: `sandbox` to start
   - `BANKFUL_BASE_URL`: only if Bankful support told you to override the default (see Step 1)
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN`: from a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database — same REST API either way)
   - `NEXT_PUBLIC_BASE_URL`: your Vercel domain (e.g., `https://veil-checkout.vercel.app`) — Bankful redirects back here after payment
   - `STRIPE_SECRET_KEY` / `QB_CLIENT_ID` / `QB_CLIENT_SECRET`: only needed if you still have orders placed under the old processors that you might need to refund
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
3. Fill in the contact/shipping fields and click **Place order** — you'll be redirected to Bankful's hosted page
4. Use one of Bankful's sandbox test card values (ask Bankful support for these if their docs don't already show sandbox amount/decline thresholds) to complete the payment
5. Confirm you're redirected back to `/success`, and that the order actually shows up in the admin Orders tab — if the browser makes it back to `/success` but the order never appears, the webhook isn't reaching `/api/bankful-webhook` (check Bankful's callback delivery logs if they expose any, and confirm `NEXT_PUBLIC_BASE_URL` was set correctly at the time the order was placed, since that's what gets baked into `url_callback`)
6. Test a decline too, and confirm it lands on `/success?status=failed` with a clear message instead of silently succeeding

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
- `/success` — Order confirmation page (also handles Bankful's failed/pending/cancel redirect outcomes)

### Components
- `Header.jsx` — Navigation, cart button, logo
- `CartDrawer.jsx` — Slide-in cart, links to `/checkout`
- Product data at `lib/products.js`

### Architecture
- **Frontend**: Next.js React app (all pages)
- **Cart state**: React Context (`lib/useCart.js`), persisted to `localStorage` so it survives navigation to `/checkout`
- **Backend**: Vercel serverless functions at `/api/bankful-checkout` (saves the pending order, starts the hosted-page payment) and `/api/bankful-webhook` (the only place that actually fulfills a Bankful order, on Bankful's signature-verified async callback) — plus legacy-refund-only routes for orders placed before the Bankful switch (`lib/stripeServer.js`, `lib/qbPaymentsServer.js` + `/api/qb-auth/connect` + `/api/qb-auth/callback`)
- **Payments**: card details are collected entirely on Bankful's own hosted page (`lib/bankfulServer.js` builds and signs the request that starts it) — this app never sees raw card data
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `BANKFUL_PASSWORD` (also the HMAC-SHA256 signing key for every Bankful request/callback), `STRIPE_SECRET_KEY`, `QB_CLIENT_SECRET`, and the KV-stored QuickBooks tokens live only in Vercel's environment variables / KV store (never in code)
- Payment details never reach our server or our own client-side JS — the shopper enters their card directly on Bankful's hosted page; this app only ever sees Bankful's own order/transaction ids, never a raw card number
- The Bankful webhook verifies Bankful's HMAC-SHA256 signature on every request (`verifyCallbackSignature` in `lib/bankfulServer.js`) before trusting it — an unsigned or forged request can't trigger fulfillment
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"BANKFUL_USERNAME / BANKFUL_PASSWORD are not set" error:**
- Add both in Vercel's Environment Variables and redeploy

**Redirected to Bankful, but "Could not start Bankful checkout" appears before that:**
- Check the server logs for the actual error Bankful returned — a wrong `BANKFUL_BASE_URL` for your credentials (see Step 1) is a likely cause

**Payment succeeds on Bankful's page but no order shows up / admin wasn't notified:**
- The webhook likely never reached `/api/bankful-webhook`, or its signature failed verification — check whatever delivery logs Bankful exposes for the callback, and confirm `NEXT_PUBLIC_BASE_URL` was correct (and matched your real deployed domain) when the order was placed, since that's what `url_callback` was built from

**"KV_REST_API_URL / KV_REST_API_TOKEN are not set" error:**
- Provision a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database) and add its REST URL/token to your environment variables

**Refunding a legacy Stripe/PayPal/QuickBooks order fails:**
- Those refund paths need their original processor's credentials (`STRIPE_SECRET_KEY`, or `QB_CLIENT_ID`/`QB_CLIENT_SECRET` with a valid `/api/qb-auth/connect` authorization) still set, even though checkout itself no longer uses them

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Next Steps

1. Deploy this to Vercel
2. Provision a KV store and add `BANKFUL_USERNAME` / `BANKFUL_PASSWORD` / `BANKFUL_ENVIRONMENT` / `KV_REST_API_URL` / `KV_REST_API_TOKEN` (sandbox Bankful credentials to start — see Step 1)
3. Confirm with Bankful support which base URL your sandbox credentials actually work against, and set `BANKFUL_BASE_URL` if it differs from the default
4. Test a full checkout with a Bankful sandbox card, and confirm the order actually shows up in the admin Orders tab (not just that the browser redirect looked successful)
5. Test a refund of that order from the admin Orders tab
6. When ready for real charges, switch `BANKFUL_ENVIRONMENT` to `live` and swap in live Bankful credentials
7. Connect your domain
