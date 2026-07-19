# VEIL Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that charges cards directly via Bankful's Payment Service API, right on `/checkout` (no Shopify, no redirect off-site). Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) — card number/expiry/CVC/name entered right on the page, charged directly through Bankful
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)

---

## Step 1: Set Up Bankful

1. Get your Bankful merchant credentials (username/password) from Bankful — these go in `BANKFUL_USERNAME` / `BANKFUL_PASSWORD`.
2. Set `BANKFUL_ENVIRONMENT` to `sandbox` while testing, `live` once you're ready for real charges.
3. Ask Bankful support to confirm which API host your sandbox and live credentials actually work against, and set `BANKFUL_BASE_URL` explicitly if it differs from the default this codebase picks based on `BANKFUL_ENVIRONMENT`. **This matters** — Bankful's own documentation lists `api-dev1.bankfulportal.com` as the sandbox host, but its curl examples (even ones using sandbox credentials) target `api.paybybankful.com`. That inconsistency was never resolved during this integration; don't assume the default in `lib/bankfulServer.js` is correct without confirming.

### How the payment flow works

1. Shopper fills in contact/shipping info and their card details (number, expiry, CVC, name) directly on `/checkout` and clicks **Place order**.
2. `/api/bankful-checkout` sends the card straight to Bankful's `POST /api/transaction/api` endpoint with `transaction_type=CAPTURE` — a one-shot authorize-and-capture, no separate settlement step.
3. Bankful's response comes back in the same request — `TRANS_STATUS_NAME: "APPROVED"` or `"DECLINED"`. No redirect, no webhook to wait on.
4. On approval, the order is fulfilled immediately (recorded, admins notified, Meta Purchase event fired) and the shopper is sent to `/success`. On decline, the error is shown right on the checkout form and nothing is charged.

### ⚠️ PCI compliance note

Because card details are typed directly into this site's own form and sent to Bankful from this app's server (rather than being collected on a processor-hosted page), raw card data does pass through the server for the duration of each charge request. It is never logged and never persisted anywhere — but this generally puts a site in PCI DSS **SAQ D** scope (more security requirements you're responsible for), rather than the lighter SAQ A a redirect-based/hosted-page integration would get. Confirm your actual compliance obligations with Bankful and/or your acquiring bank before taking real charges this way.

### ⚠️ Things worth confirming with Bankful support before relying on this in production

This integration was built entirely from Bankful's own pasted documentation, without access to a live account to test against.

1. **Sandbox vs. live base URL** — see above.
2. **Decline/error response fields** — Bankful's docs only explicitly document `API_ADVICE` / `SERVICE_ADVICE` / `PROCESSOR_ADVICE` / `ERROR_MESSAGE` on the Cancel-transaction failure response. This codebase assumes the same fields appear on a declined Sale/Auth response too (`lib/bankfulServer.js`'s `declineMessage`), since it's the same underlying gateway, but that's an assumption — confirm the actual shape of a declined-Sale response against a real sandbox decline.

Run a real sandbox transaction, a real sandbox decline, and a refund, before taking this live.

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
   - `NEXT_PUBLIC_BASE_URL`: your Vercel domain (e.g., `https://veil-checkout.vercel.app`)
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
3. Fill in the contact/shipping fields, then fill in the card fields at the bottom (card number, expiration, CVC, name) with one of Bankful's sandbox test card values (ask Bankful support for these if their docs don't already show sandbox amount/decline thresholds)
4. Click **Place order** and confirm you land on `/success`, and that the order actually shows up in the admin Orders tab
5. Test a decline too (Bankful's sandbox docs mention amount-based decline thresholds) and confirm a clear error appears on the checkout form instead of silently succeeding

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
- **Backend**: Vercel serverless function at `/api/bankful-checkout` (charges the card via Bankful's Payment Service API and fulfills the order in the same request) — plus legacy-refund-only routes for orders placed before the Bankful switch (`lib/stripeServer.js`, `lib/qbPaymentsServer.js` + `/api/qb-auth/connect` + `/api/qb-auth/callback`)
- **Payments**: card fields are collected on `/checkout` and sent straight through to Bankful's `POST /api/transaction/api` from `pages/api/bankful-checkout.js` — see the PCI note in Step 1
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `BANKFUL_PASSWORD`, `STRIPE_SECRET_KEY`, `QB_CLIENT_SECRET`, and the KV-stored QuickBooks tokens live only in Vercel's environment variables / KV store (never in code)
- Card details submitted on `/checkout` are sent over HTTPS to `/api/bankful-checkout`, forwarded directly to Bankful, and never logged or persisted anywhere in this app — but they do pass through this app's server, unlike a hosted-page integration (see the PCI note in Step 1)
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"BANKFUL_USERNAME / BANKFUL_PASSWORD are not set" error:**
- Add both in Vercel's Environment Variables and redeploy

**Payment fails immediately with a generic error:**
- Check the server logs for the actual message Bankful returned — a wrong `BANKFUL_BASE_URL` for your credentials (see Step 1) is a likely cause

**Payment succeeds but no order shows up / admin wasn't notified:**
- Fulfillment happens in the same request as the charge — if the charge succeeded but this failed, check the server logs around `/api/bankful-checkout` for the actual error (KV store misconfiguration is the most common cause)

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
4. Test a full checkout with a Bankful sandbox card, and confirm the order actually shows up in the admin Orders tab
5. Test a decline and a refund
6. When ready for real charges, switch `BANKFUL_ENVIRONMENT` to `live` and swap in live Bankful credentials
7. Connect your domain
