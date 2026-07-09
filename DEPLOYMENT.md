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
4. Under the **Development** tab, grab the **Client ID** and **Client Secret** for the Sandbox environment (use Production once you're ready to take real charges).
5. Complete the app's OAuth flow once (Intuit's docs walk through this) to obtain an **access token**. This is what goes in `QB_ACCESS_TOKEN`.
6. Before taking real charges, open `lib/qbPayments.js` and confirm the client-side tokenization call matches the current snippet shown in your app's Dashboard under **Payments > Web Payments SDK** — Intuit has changed this SDK's method names across versions, and that file has a code comment flagging exactly what to check.

**Known gap:** QuickBooks access tokens expire roughly hourly and need a refresh token exchange to renew. This project doesn't yet store/refresh tokens automatically — `QB_ACCESS_TOKEN` will need to be rotated manually (or a refresh job added to `pages/api/qb-checkout.js`) until that's built.

---

## Step 2: Deploy to Vercel

### Option A: Quick Deploy (Recommended)

1. Go to https://vercel.com and sign up (or log in with GitHub)
2. Click "New Project" → "Import Git Repository"
3. Select this repo
4. Click "Deploy"
5. After deployment, go to "Settings" → "Environment Variables"
6. Add:
   - `QB_ACCESS_TOKEN`: the access token from Step 1
   - `QB_ENVIRONMENT`: `sandbox` or `production`
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
- **Backend**: Vercel serverless function at `/api/qb-checkout` (charges a card token via the QuickBooks Payments API)
- **Payments**: QuickBooks Payments — card details are tokenized client-side (`lib/qbPayments.js`) before ever reaching the server
- **Hosting**: Vercel (free tier handles all traffic)
- **Database**: None (stateless — cart data lives in the browser)

---

## Security Notes

- `QB_ACCESS_TOKEN` lives only in Vercel's environment variables (never in code)
- Card numbers are tokenized in the browser before submission — the server only ever sees a one-time token, not raw card data
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"QuickBooks Payments is not configured yet" error:**
- `QB_ACCESS_TOKEN` is missing or empty in Vercel's environment variables

**Charge fails with an auth error:**
- The access token has likely expired (they last ~60 minutes) — get a fresh one via the OAuth flow and update `QB_ACCESS_TOKEN`

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Next Steps

1. Deploy this to Vercel
2. Add your `QB_ACCESS_TOKEN`
3. Verify the tokenization call in `lib/qbPayments.js` against Intuit's current dashboard snippet
4. Connect your domain
5. Test with a sandbox transaction
6. Add token-refresh handling before relying on this for real, ongoing sales
