# VEIL Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that charges cards via QuickBooks Payments (no Shopify, no hosted redirect). Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) — card number/expiry/CVC/name tokenized client-side against Intuit's API, then charged via QuickBooks Payments
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)

---

## Step 1: Set Up QuickBooks Payments

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

If charges still fail after both of the above are correct, the remaining possibility is Intuit's separate Payments production-access approval (business verification / security questionnaire, found under the app's **Payments** tab if applicable). Test with a real sandbox charge (Step 4 below) before relying on this in production.

---

## Step 2: Deploy to Vercel

### Option A: Quick Deploy (Recommended)

1. Go to https://vercel.com and sign up (or log in with GitHub)
2. Click "New Project" → "Import Git Repository"
3. Select this repo
4. Click "Deploy"
5. After deployment, go to "Settings" → "Environment Variables"
6. Add:
   - `QB_CLIENT_ID` / `QB_CLIENT_SECRET`: from Step 1
   - `QB_ENVIRONMENT` and `NEXT_PUBLIC_QB_ENVIRONMENT`: both `sandbox` (or both `production` once approved — see Step 1)
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN`: from a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database — same REST API either way)
   - `NEXT_PUBLIC_BASE_URL`: your Vercel domain (e.g., `https://veil-checkout.vercel.app`)
   - `STRIPE_SECRET_KEY`: only needed if you still have orders placed via Stripe that you might need to refund
7. Redeploy by going to "Deployments" → last deployment → "Redeploy"
8. Visit `/api/qb-auth/connect` once to authorize (see Step 1)

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
3. Fill in the contact/shipping fields, then the card fields with one of Intuit's [sandbox test cards](https://developer.intuit.com/app/developer/qbpayments/docs/develop/sandboxes/payments-test-cards) — real card numbers don't work against the sandbox environment
4. Submit and check your QuickBooks Payments dashboard — the charge should appear
5. This is the integration that hit an unresolved 403 previously (see Step 1) — if it fails, work through that section's two gotchas before assuming something else is broken

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
- **Backend**: Vercel serverless function at `/api/qb-checkout` (charges a QuickBooks card token and fulfills directly, no webhook needed since there's no off-site redirect step) plus `/api/qb-auth/connect` + `/api/qb-auth/callback` (one-time QuickBooks OAuth authorization)
- **Payments**: card details are tokenized client-side (`lib/qbPayments.js`, a direct call to Intuit's Payments Tokens REST endpoint) before ever reaching the server — the server only ever sees a one-time card token
- **QuickBooks token refresh**: `lib/qbServerAuth.js` transparently refreshes the QuickBooks access token using a refresh token persisted in the KV store (`lib/qbTokenStore.js`) before every charge — no manual token rotation
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `QB_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, and the KV-stored QuickBooks tokens live only in Vercel's environment variables / KV store (never in code)
- Payment details never reach our server — the QuickBooks card form tokenizes directly against Intuit's API from the browser, so the server only ever sees a one-time card token, never a raw card number
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"QuickBooks Payments is not connected yet" error:**
- Visit `/api/qb-auth/connect` once to authorize (see Step 1) — this only needs to happen once per environment (sandbox/production each need their own authorization)

**QuickBooks charge fails with an empty-body 403, or a 401 "AuthenticationFailed":**
- See the two gotchas under Step 1 — a Development/Production credential mismatch with `QB_ENVIRONMENT`, and requesting the accounting scope alongside the payment scope, are both far more common causes than an actual account/approval problem

**"KV_REST_API_URL / KV_REST_API_TOKEN are not set" error:**
- Provision a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database) and add its REST URL/token to your environment variables

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## About the Bankful integration

A Bankful checkout integration also exists in the codebase (`lib/bankfulServer.js`), left over from a prior attempt to switch processors. It's not currently wired up to `/checkout` — it returned a **"merchant not configured, please contact Gateway"** error from Bankful's own API, which needs to be resolved with Bankful support (likely either a sandbox/live host mismatch, or the merchant account not being enabled for direct card charges) before it can be tried again. The admin Orders tab has a `bankful` refund branch ready to go if that integration is ever revived.

---

## Next Steps

1. Deploy this to Vercel
2. Provision a KV store and add `QB_CLIENT_ID` / `QB_CLIENT_SECRET` / `QB_ENVIRONMENT` / `NEXT_PUBLIC_QB_ENVIRONMENT` / `KV_REST_API_URL` / `KV_REST_API_TOKEN` (sandbox QuickBooks keys to start — see Step 1)
3. Visit `/api/qb-auth/connect` once to authorize
4. Test a full checkout with a QuickBooks sandbox card
5. When ready for real charges, swap to the Production Client ID/Secret + redirect URI and switch `QB_ENVIRONMENT`/`NEXT_PUBLIC_QB_ENVIRONMENT` to `production`
6. Connect your domain
