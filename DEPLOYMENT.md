# VEIL Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that charges cards directly via Stripe or QuickBooks Payments — shopper's choice (no Shopify, no hosted redirect). Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) with a processor toggle — Stripe's Payment Element (card, Klarna, Afterpay/Clearpay, Link, Amazon Pay, PayPal, Cash App Pay, all in one embedded element) or a QuickBooks Payments card form, shopper picks either
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

## Step 1B: Set Up QuickBooks Payments (optional second processor)

Checkout offers this as an alternative to Stripe, not a replacement — shoppers pick one or the other. Skip this step entirely if you only want Stripe.

1. Go to https://developer.intuit.com and sign in (or create an Intuit account).
2. Create a new app → **QuickBooks Online and Payments**.
3. On the app's **Payments** tab, enable QuickBooks Payments. This is tied to a merchant account — if you don't already have QuickBooks Payments active on your QuickBooks Online account, you'll need to complete Intuit's merchant underwriting first.
4. Under **Keys & OAuth**, grab the **Client ID** and **Client Secret** for the Sandbox environment (use Production once you're ready to take real charges). These go in `QB_CLIENT_ID` / `QB_CLIENT_SECRET`.
5. In that same **Keys & OAuth** section, add a redirect URI: `https://YOUR_DOMAIN/api/qb-auth/callback` (use your Vercel URL, or `http://localhost:3000/api/qb-auth/callback` for local testing).
6. After deploying and setting env vars (Step 2), visit `/api/qb-auth/connect` once to authorize.

### ⚠️ Two non-obvious ways to get the Charges API to fail even with a valid OAuth connection

This exact integration hit an unresolved 403 on a previous attempt on this site. Both of the causes below were root-caused by direct testing against Intuit's sandbox and are easy to hit again — check both before assuming something else is wrong:

1. **Development vs. Production credentials must match `QB_ENVIRONMENT`.** Intuit issues a completely separate Client ID/Secret pair per environment (Keys & Credentials → Development / Production tabs), each with its own Redirect URIs list (Settings → Redirect URIs → Development / Production tabs). Using a Production Client ID while `QB_ENVIRONMENT=sandbox` (or vice versa) produces an access token whose environment doesn't match the API base URL it's sent to — Intuit's gateway rejects it with an **empty-body 403** before the request ever reaches real charge logic. Fix: make sure `QB_CLIENT_ID`/`QB_CLIENT_SECRET` come from the same Development/Production tab as `QB_ENVIRONMENT`, and that the matching redirect URI is registered under that same tab.
2. **Don't request `com.intuit.quickbooks.accounting` together with `com.intuit.quickbooks.payment`** in the same OAuth authorization. A combined-scope token consistently 401s (`AuthenticationFailed`) on the Payments Charges API even though it's otherwise valid — request `com.intuit.quickbooks.payment` alone (already how `pages/api/qb-auth/connect.js` is written).

If charges still fail after both of the above are correct, the remaining possibility is Intuit's separate Payments production-access approval (business verification / security questionnaire, found under the app's **Payments** tab if applicable). Test with a real sandbox charge (Step 4B below) before relying on this in production — it has not been re-verified working since being restored.

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
   - `QB_CLIENT_ID` / `QB_CLIENT_SECRET`: from Step 1B, if you're offering QuickBooks too
   - `QB_ENVIRONMENT` and `NEXT_PUBLIC_QB_ENVIRONMENT`: both `sandbox` (or both `production` once approved — see Step 1B), if using QuickBooks
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN`: from a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database — same REST API either way)
   - `NEXT_PUBLIC_BASE_URL`: your Vercel domain (e.g., `https://veil-checkout.vercel.app`)
7. Redeploy by going to "Deployments" → last deployment → "Redeploy"
8. If using QuickBooks, visit `/api/qb-auth/connect` once to authorize (see Step 1B)

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

### Step 4A: Stripe

1. Go to your deployed domain
2. Add a product to the cart and click "Checkout"
3. Leave the "Card, Klarna & more" processor selected (default)
4. With test-mode keys, use one of Stripe's [test cards](https://docs.stripe.com/testing#cards) — e.g. `4242 4242 4242 4242`, any future expiry, any CVC, to test a 3D Secure challenge use `4000 0027 6000 3184`
5. Check your Stripe dashboard (Payments) — the charge should appear

### Step 4B: QuickBooks (if enabled)

1. On the same checkout page, click the "QuickBooks" processor toggle
2. Use one of Intuit's [sandbox test cards](https://developer.intuit.com/app/developer/qbpayments/docs/develop/sandboxes/payments-test-cards) — real card numbers don't work against the sandbox environment
3. Check your QuickBooks Payments dashboard — the charge should appear
4. This is the integration that hit an unresolved 403 previously (see Step 1B) — if it fails, work through that section's two gotchas before assuming something else is broken

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
- **Backend**: Vercel serverless functions at `/api/stripe/create-intent` (starts a PaymentIntent as soon as checkout is ready to show payment options), `/api/stripe/update-intent` (attaches order details right before submit), and `/api/stripe/webhook` (the only place that actually fulfills a Stripe order, on `payment_intent.succeeded`) — plus `/api/qb-checkout` (charges a QuickBooks card token and fulfills directly, no webhook needed since there's no off-site redirect step) and `/api/qb-auth/connect` + `/api/qb-auth/callback` (one-time QuickBooks OAuth authorization)
- **Payments**: shopper picks the processor at checkout. Stripe Payment Element (`lib/stripeClient.js`) — a single Stripe-hosted iframe covering card, Klarna, Afterpay/Clearpay, Link, Amazon Pay, PayPal, and Cash App Pay, so raw payment details never reach our own JS or server. QuickBooks Payments — card details are tokenized client-side (`lib/qbPayments.js`, a direct call to Intuit's Payments Tokens REST endpoint) before ever reaching the server
- **QuickBooks token refresh**: `lib/qbServerAuth.js` transparently refreshes the QuickBooks access token using a refresh token persisted in the KV store (`lib/qbTokenStore.js`) before every charge — no manual token rotation
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `QB_CLIENT_SECRET`, and the KV-stored QuickBooks tokens live only in Vercel's environment variables / KV store (never in code)
- Payment details never reach our server or our own client-side JS — the Stripe Payment Element collects them directly into Stripe-controlled iframes, and the QuickBooks card form tokenizes directly against Intuit's API from the browser; either way, the server only ever sees a reference (PaymentIntent id or one-time card token), never a raw card number
- The Stripe webhook verifies Stripe's signature on every request (`stripe.webhooks.constructEvent`) before trusting it — an unsigned or forged request can't trigger fulfillment
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

**"QuickBooks Payments is not connected yet" error:**
- Visit `/api/qb-auth/connect` once to authorize (see Step 1B) — this only needs to happen once per environment (sandbox/production each need their own authorization)

**QuickBooks charge fails with an empty-body 403, or a 401 "AuthenticationFailed":**
- See the two gotchas under Step 1B — a Development/Production credential mismatch with `QB_ENVIRONMENT`, and requesting the accounting scope alongside the payment scope, are both far more common causes than an actual account/approval problem

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Next Steps

1. Deploy this to Vercel
2. Provision a KV store and add `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `KV_REST_API_URL` / `KV_REST_API_TOKEN` (test-mode Stripe keys to start — see Step 1)
3. Register the webhook (needs your real deployed URL — see Step 1) and add `STRIPE_WEBHOOK_SECRET`
4. Enable whichever of Klarna/Afterpay/Link/Amazon Pay/PayPal/Cash App Pay you want to offer (see Step 1)
5. Test a full checkout with a Stripe test card
6. If also offering QuickBooks: set up an Intuit app (Step 1B), add `QB_CLIENT_ID`/`QB_CLIENT_SECRET`/`QB_ENVIRONMENT`/`NEXT_PUBLIC_QB_ENVIRONMENT`, visit `/api/qb-auth/connect` once, and test a sandbox charge (Step 4B) — treat this path as unverified until that test actually succeeds
7. When ready for real charges, switch the Stripe dashboard to live mode, swap both Stripe keys for their live-mode equivalents, and register a second (live-mode) webhook; for QuickBooks, swap to the Production Client ID/Secret + redirect URI and switch `QB_ENVIRONMENT`/`NEXT_PUBLIC_QB_ENVIRONMENT` to `production`
8. Connect your domain
