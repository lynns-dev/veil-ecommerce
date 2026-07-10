# VEIL Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that charges cards directly via QuickBooks Payments (no Shopify, no hosted redirect). Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) that charges QuickBooks Payments directly
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)

---

## Step 1: Set Up QuickBooks Payments

1. Go to https://developer.intuit.com and sign in (or create an Intuit account).
2. Create a new app → **QuickBooks Online and Payments**.
3. On the app's **Payments** tab, enable QuickBooks Payments. This is tied to a merchant account — if you don't already have QuickBooks Payments active on your QuickBooks Online account, you'll need to complete Intuit's merchant underwriting first.
4. Under **Keys & OAuth**, grab the **Client ID** and **Client Secret** for the Sandbox environment (use Production once you're ready to take real charges). These go in `QB_CLIENT_ID` / `QB_CLIENT_SECRET`.
5. In that same **Keys & OAuth** section, add a redirect URI: `https://YOUR_DOMAIN/api/qb-auth/callback` (use your Vercel URL, or `http://localhost:3000/api/qb-auth/callback` for local testing).

### ⚠️ Required before Production charges will work: request Payments production access

Having Production `QB_CLIENT_ID`/`QB_CLIENT_SECRET` and a completed OAuth connection is **not** enough to actually charge cards in production. Intuit gates live use of the Payments Charges API behind a separate approval step — without it, charge requests fail with a 403 even though the OAuth token itself is valid (this is exactly what happened on the first attempt at this integration: OAuth succeeded, scopes were correct, and Intuit's own API Explorer reproduced the same 403 under the account, which is the signature of this specific gate, not a bug in the code).

To find and complete it:
- In your Intuit Developer app, look under the **Payments** tab for a **Production**/**Go Live** section — it typically lists remaining requirements (business verification, a short security questionnaire) before Production Payments API calls are unblocked.
- If nothing about this is visible in the dashboard, contact Intuit Developer Support directly and ask what's required to move your app's **Payments API** (not just general QuickBooks Online API access) to production.
- **Sandbox does not require this approval** — always confirm the full flow (connect → tokenize → charge) works in sandbox first before chasing production approval, so you know the code path itself is sound.

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
7. Redeploy by going to "Deployments" → last deployment → "Redeploy"
8. Visit `/api/qb-auth/connect` once to authorize QuickBooks (see Step 1)

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
3. In sandbox mode, use one of Intuit's [test cards](https://developer.intuit.com/app/developer/qbpayments/docs/develop/sandboxes/payments-test-cards)
4. Check your QuickBooks Payments dashboard — the charge should appear

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
- **Backend**: Vercel serverless functions at `/api/qb-checkout` (charges a card token via the QuickBooks Payments API) and `/api/qb-auth/connect` + `/api/qb-auth/callback` (one-time OAuth authorization)
- **Payments**: QuickBooks Payments — card details are tokenized client-side (`lib/qbPayments.js`, a direct call to Intuit's Payments Tokens REST endpoint) before ever reaching the server
- **Token refresh**: `lib/qbServerAuth.js` transparently refreshes the QuickBooks access token using a refresh token persisted in the KV store (`lib/qbTokenStore.js`) before every charge — no manual token rotation
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `QB_CLIENT_SECRET` and the KV-stored tokens live only in Vercel's environment variables / KV store (never in code)
- Card numbers are tokenized in the browser before submission — the server only ever sees a one-time token, not raw card data
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"QuickBooks Payments is not connected yet" error:**
- Visit `/api/qb-auth/connect` to complete the one-time authorization

**Charge fails with a 403, and the OAuth connection is valid:**
- This is almost always the missing Payments production-access approval described in Step 1, not a bug — confirm the same flow works in `sandbox` first, then chase down that approval with Intuit for `production`

**"KV_REST_API_URL / KV_REST_API_TOKEN are not set" error:**
- Provision a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database) and add its REST URL/token to your environment variables

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Next Steps

1. Deploy this to Vercel
2. Provision a KV store and add `QB_CLIENT_ID` / `QB_CLIENT_SECRET` / `KV_REST_API_URL` / `KV_REST_API_TOKEN`
3. Visit `/api/qb-auth/connect` once to authorize QuickBooks, with `QB_ENVIRONMENT=sandbox`
4. Test a full checkout with an Intuit sandbox test card
5. Request Payments production access from Intuit (Step 1) before switching `QB_ENVIRONMENT` / `NEXT_PUBLIC_QB_ENVIRONMENT` to `production`
6. Connect your domain
