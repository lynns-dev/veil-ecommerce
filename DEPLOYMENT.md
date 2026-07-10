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
6. Before taking real charges, open `lib/qbPayments.js` and confirm the client-side tokenization call matches the current snippet shown in your app's Dashboard under **Payments > Web Payments SDK** — Intuit has changed this SDK's method names across versions, and that file has a code comment flagging exactly what to check.

### Connecting the account (one time only)

This project stores QuickBooks tokens in a KV store and refreshes them automatically — once you connect, checkout stays authorized all day, indefinitely, with no manual token rotation.

1. Set up a KV store: in Vercel, go to **Storage → Create Database → KV** (or use a standalone [Upstash](https://upstash.com) Redis database — same REST API either way). Copy `KV_REST_API_URL` and `KV_REST_API_TOKEN` into your environment variables.
2. Set `QB_CLIENT_ID`, `QB_CLIENT_SECRET`, `QB_ENVIRONMENT`, and `NEXT_PUBLIC_BASE_URL` in your environment (see Step 2 below).
3. Visit `https://YOUR_DOMAIN/api/qb-auth/connect` in a browser. Log into the QuickBooks Online account with Payments enabled and authorize the app.
4. You'll land on a confirmation page once tokens are saved. That's it — `pages/api/qb-checkout.js` will keep itself authorized from here on (see `lib/qbServerAuth.js`), refreshing the access token automatically before it expires.

You only need to repeat step 3 if the connection is revoked in QuickBooks, or if checkout goes completely unused for 100+ days (refresh tokens expire after that long without use).

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
   - `QB_ENVIRONMENT`: `sandbox` or `production`
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN`: from your KV store (Step 1)
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
- **Backend**: Vercel serverless function at `/api/qb-checkout` (charges a card token via the QuickBooks Payments API), plus `/api/qb-auth/connect` and `/api/qb-auth/callback` for the one-time OAuth authorization
- **Payments**: QuickBooks Payments — card details are tokenized client-side (`lib/qbPayments.js`) before ever reaching the server
- **Token refresh**: `lib/qbServerAuth.js` transparently refreshes the QuickBooks access token using the stored refresh token before every charge, so it never expires mid-operation and never needs manual rotation
- **Hosting**: Vercel (free tier handles all traffic)
- **Database**: A small KV store (Vercel KV / Upstash Redis) holding only the QuickBooks token pair — cart and product data remain stateless

---

## Security Notes

- `QB_CLIENT_SECRET` and the KV store's tokens live only in Vercel's environment variables / KV store (never in code)
- Card numbers are tokenized in the browser before submission — the server only ever sees a one-time token, not raw card data
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"QuickBooks Payments is not connected yet" error:**
- Visit `/api/qb-auth/connect` to complete the one-time authorization

**"KV_REST_API_URL / KV_REST_API_TOKEN are not set" error:**
- Provision a KV store (Vercel Storage → KV, or Upstash) and add its REST URL/token to your environment variables

**Charge fails with an auth error:**
- The refresh token itself may have expired from 100+ days of inactivity — redo the one-time `/api/qb-auth/connect` flow

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Next Steps

1. Deploy this to Vercel
2. Provision a KV store and add `QB_CLIENT_ID` / `QB_CLIENT_SECRET` / `KV_REST_API_URL` / `KV_REST_API_TOKEN`
3. Verify the tokenization call in `lib/qbPayments.js` against Intuit's current dashboard snippet
4. Visit `/api/qb-auth/connect` once to authorize QuickBooks
5. Connect your domain
6. Test with a sandbox transaction
