# VEIL Full E-Commerce Site — Deployment Guide

This is a Next.js e-commerce site with a full product catalog, detailed product pages, shopping cart, and a custom checkout page that charges cards via Square (no Shopify, no hosted redirect). Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persists across pages via localStorage, sticky sidebar)
- **Custom single-page checkout** (`/checkout`, styled after Shopify's checkout) — Square's Web Payments SDK renders its own card number/expiry/CVC/postal fields client-side, tokenizes the card, then it's charged server-side via the Square Payments API
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)

---

## Step 1: Set Up Square

1. Go to https://developer.squareup.com and sign in (or create a Square account). This is tied to a Square merchant account — if you don't already have one, you'll be prompted to create it.
2. Create a new application from the Developer Dashboard.
3. Under **Credentials**, grab the **Sandbox Access Token** (use the Production Access Token once you're ready to take real charges). This goes in `SQUARE_ACCESS_TOKEN`.
4. Under **Locations**, grab the Location ID for the location you want charges attributed to. This goes in both `SQUARE_LOCATION_ID` and `NEXT_PUBLIC_SQUARE_LOCATION_ID`.
5. The application's **Application ID** (visible on the same Credentials page) goes in `NEXT_PUBLIC_SQUARE_APPLICATION_ID` — it's safe to expose to the browser, the Web Payments SDK needs it to mount the card form.
6. There's no OAuth authorization step or redirect URI to register — Square's Access Token authenticates server-side requests directly.

### A note on verification

Square's Web Payments SDK tokenize flow (`lib/squareClient.js`) was built and reviewed against Square's real "Take a Card Payment" documentation. The server-side charge/refund calls (`lib/squareServer.js`) were built from general knowledge of the Payments API rather than primary docs read at build time — the endpoint, field names, and header version string are flagged as unverified in that file's comments. Treat the first real sandbox charge and refund (Step 4 below) as the actual verification step, not just a smoke test.

---

## Step 2: Deploy to Vercel

### Option A: Quick Deploy (Recommended)

1. Go to https://vercel.com and sign up (or log in with GitHub)
2. Click "New Project" → "Import Git Repository"
3. Select this repo
4. Click "Deploy"
5. After deployment, go to "Settings" → "Environment Variables"
6. Add:
   - `SQUARE_ACCESS_TOKEN` / `SQUARE_LOCATION_ID`: from Step 1
   - `SQUARE_ENVIRONMENT`: `sandbox` (or `production` once you're ready — see Step 1)
   - `NEXT_PUBLIC_SQUARE_APPLICATION_ID` / `NEXT_PUBLIC_SQUARE_LOCATION_ID`: from Step 1
   - `KV_REST_API_URL` / `KV_REST_API_TOKEN`: from a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database — same REST API either way)
   - `NEXT_PUBLIC_BASE_URL`: your Vercel domain (e.g., `https://veil-checkout.vercel.app`)
   - `STRIPE_SECRET_KEY` / `QB_CLIENT_ID` / `QB_CLIENT_SECRET` / `QB_ENVIRONMENT`: only needed if you still have orders placed via Stripe or QuickBooks that you might need to refund — see "Refunding legacy orders" below
7. Redeploy by going to "Deployments" → last deployment → "Redeploy"

### Option B: Deploy via Git

1. Push this folder to a GitHub repo
2. Connect that repo to Vercel
3. Add environment variables (same as above)
4. Vercel auto-deploys every push

---

## Step 3 (optional): Set Up Shop Pay

An embedded Shop Pay button in the cart drawer, alongside Apple Pay — the shopper pays in a popup on this site rather than being redirected to a Shopify-hosted checkout page. Requires a Shopify store with Shopify Payments already active (Shop Pay only works through Shopify's own payment processing).

### What to set up in Shopify

Shopify retired the old "legacy custom app" screen that used to hand you a static Admin API access token and Storefront API access token directly — confirmed live against the real xjywhy-ce store admin, not assumed. Every store is now funneled into **Dev Dashboard** apps, which only ever give you a client id + client secret and require a real OAuth authorization to actually get a token. That's a bigger setup than a copy-paste, but it only has to be done once.

1. **Create (or reuse) a Dev Dashboard app** — `npm init @shopify/app@latest`, or via Shopify's Partner/Dev Dashboard directly. This gives you a **Client ID** and **Client Secret**.
   - `SHOPIFY_STORE_DOMAIN`: the store's `*.myshopify.com` address (e.g. `xjywhy-ce.myshopify.com`).
   - `SHOPIFY_CLIENT_ID` / `SHOPIFY_CLIENT_SECRET`: from that app's Credentials page. Treat the secret like any other production credential — if it's ever been pasted somewhere insecure (a chat, a ticket), rotate it from that same page before going live.
2. **Declare Admin API scopes** for the app: `read_orders`, `write_orders`. Where this lives depends on how the app was created — for a CLI-scaffolded app it's `shopify.app.toml`'s `[access_scopes]`; for one made directly in Dev Dashboard, look for a Configuration/API access section. The OAuth flow below requests exactly `read_orders,write_orders` — if the app has fewer scopes declared than that, Shopify's approval screen won't grant it.
3. **Allow-list the OAuth redirect URL**: same app's settings, add `https://<your-domain>/api/shopify-auth/callback` to whatever field lists allowed redirect/callback URLs.
4. **A cron secret you make up yourself** (any random string, not from Shopify) → `CRON_SECRET`. Protects `/api/shop-pay/reconcile` (the fallback for a webhook that never arrives) from being triggered by anyone but Vercel's own scheduler.
5. **Deploy with those four env vars set**, then visit `https://<your-domain>/api/shopify-auth/connect` once in a browser and approve the authorization screen. This one visit does everything the old legacy-app screen used to require manually:
   - exchanges the authorization code for an Admin API access token and stores it
   - uses that token to mint a Storefront API access token (`storefrontAccessTokenCreate`) and stores it too
   - registers the `orders/create` webhook that makes order recording actually work
   - You should never need to visit `/connect` again unless the connection is revoked from Shopify admin (uninstalling the app).
6. **Product variants**: every item that can appear in a Shop Pay cart needs a matching Shopify product/variant, including the free Tassel gift — create a $0 variant for it too, or Shop Pay simply won't offer itself on a cart that includes the free gift (which is every cart, since checkout adds it automatically). Copy each variant's numeric id from its admin URL into `lib/shopifyProductMap.js`'s `SHOPIFY_VARIANT_MAP`.

`SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, and `SHOPIFY_WEBHOOK_SECRET` are **not** env vars anymore — the OAuth connect flow obtains and stores the first two itself (`lib/shopifyTokenStore.js`, backed by the same KV store everything else here uses), and webhook signatures are verified with `SHOPIFY_CLIENT_SECRET` directly, since the separate "webhook secret" only ever existed on the retired legacy screen.

### A note on verification

shopify.dev was unreachable from the environment this was built in (bot-protection blocked every fetch attempt), so most of this was built from Shopify's own indexed API schema pages and a Shopify Partner's published reference connector rather than reading the primary docs directly. `lib/shopPayServer.js` and `lib/shopPayClient.js` both flag exactly which pieces are lower-confidence in their file-level comments — mainly the Shop Pay session-create mutation's precise field shapes, and the browser SDK's exact method/event names. The OAuth install flow itself (`buildShopifyAuthorizeUrl`, `verifyOAuthCallbackHmac`, `exchangeShopifyAuthorizationCode`) is Shopify's classic, long-stable mechanism and doesn't carry that same uncertainty — and it's been exercised end-to-end over real HTTP (state/HMAC verification correctly rejects a forged, tampered, or mismatched callback; a genuine one passes both checks and reaches the real token-exchange call). Everything downstream of a created session (webhook HMAC verification, order recording, refunds, the reconciliation fallback) is either standard Shopify webhook behavior or shares this codebase's existing, already-proven order-fulfillment path — that part doesn't need re-verifying either.

Once connected: open the app's GraphiQL explorer if Dev Dashboard offers one for this app, and confirm `shopPayPaymentRequestSessionCreate`'s real input/return shape matches `lib/shopPayServer.js`. Then open the site with a cart containing only mapped items and confirm the button actually renders and opens a working sheet — that's the one live check this integration needs before real traffic sees it.

### A note on the reconciliation cron

Vercel Cron on the free/Hobby plan is limited to once-per-day schedules — `vercel.json` here requests every 10 minutes, which needs a Pro plan (or higher) to actually run that often. On Hobby, either upgrade or expect Vercel to silently collapse it to once a day; check what Vercel's dashboard actually shows for this cron job after deploying rather than assuming the configured schedule took effect.

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
3. Fill in the contact/shipping fields, then the card fields in the Square-hosted card form with one of Square's [sandbox test cards](https://developer.squareup.com/docs/testing/test-values) — real card numbers don't work against the sandbox environment
4. Submit and check your Square Dashboard (Transactions) — the charge should appear
5. Test a refund from the admin Orders tab, and confirm it appears in the Square Dashboard too — this is the "unverified until exercised" integration flagged in Step 1

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
- `/offer3` — Single-page ad-funnel checkout (its own product + shipping + payment step)
- `/success` — Order confirmation page

### Components
- `Header.jsx` — Navigation, cart button, logo
- `CartDrawer.jsx` — Slide-in cart, links to `/checkout`
- Product data at `lib/products.js`

### Architecture
- **Frontend**: Next.js React app (all pages)
- **Cart state**: React Context (`lib/useCart.js`), persisted to `localStorage` so it survives navigation to `/checkout`
- **Backend**: Vercel serverless function at `/api/square-checkout` (charges a Square card token and fulfills directly, no webhook needed since there's no off-site redirect step)
- **Payments**: card details are entered into Square's own hosted fields (`lib/squareClient.js`, Square's Web Payments SDK) and tokenized before ever reaching the server — the server only ever sees a one-time payment token
- **Hosting**: Vercel (free tier handles all traffic)

---

## Security Notes

- `SQUARE_ACCESS_TOKEN` lives only in Vercel's environment variables (never in code)
- Payment details never reach our server — Square's Web Payments SDK collects and tokenizes card data directly in the browser, so the server only ever sees a one-time payment token, never a raw card number
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"Payment form failed to load" on checkout:**
- Confirm `NEXT_PUBLIC_SQUARE_APPLICATION_ID` and `NEXT_PUBLIC_SQUARE_LOCATION_ID` are set and match the `SQUARE_ENVIRONMENT` (a production Application ID against `SQUARE_ENVIRONMENT=sandbox`, or vice versa, will fail to mount)
- Open the browser console — the Web Payments SDK reports the specific failure reason there

**Square charge fails with an error from `/api/square-checkout`:**
- Check the Vercel function logs for the `Square charge:` log line in `lib/squareServer.js` — it logs the full status Square returned
- Confirm `SQUARE_ACCESS_TOKEN` and `SQUARE_LOCATION_ID` are from the same environment (sandbox token against a production location, or vice versa, will fail)

**"KV_REST_API_URL / KV_REST_API_TOKEN are not set" error:**
- Provision a KV store (Vercel Storage → Marketplace → Upstash, or a standalone Upstash Redis database) and add its REST URL/token to your environment variables

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

---

## Refunding legacy orders (Stripe, QuickBooks, PayPal, Bankful)

Checkout has moved processors more than once on this site; the admin Orders tab keeps a per-processor refund branch (`pages/api/admin/orders/refund.js`) so any order can still be refunded regardless of which processor originally took the payment:

- **QuickBooks** — `lib/qbPaymentsServer.js` (refund only) + `lib/qbServerAuth.js`/`qbTokenStore.js` for token refresh. Needs `QB_CLIENT_ID` / `QB_CLIENT_SECRET` / `QB_ENVIRONMENT`, and a one-time authorization at `/api/qb-auth/connect` if you still have unrefunded QuickBooks orders.
- **Stripe** — `lib/stripeServer.js` (refund only). Needs `STRIPE_SECRET_KEY`.
- **PayPal** — `lib/paypal.js` (refund only).
- **Bankful** — `lib/bankfulServer.js`, left over from a prior attempt to switch processors that was never fully wired up to `/checkout` (it returned a "merchant not configured, please contact Gateway" error from Bankful's own API). The admin Orders tab's `bankful` refund branch is ready if that integration is ever revived.

None of the above are needed for a fresh store with no pre-Square order history.

---

## Next Steps

1. Deploy this to Vercel
2. Provision a KV store and add `SQUARE_ACCESS_TOKEN` / `SQUARE_LOCATION_ID` / `SQUARE_ENVIRONMENT` / `NEXT_PUBLIC_SQUARE_APPLICATION_ID` / `NEXT_PUBLIC_SQUARE_LOCATION_ID` / `KV_REST_API_URL` / `KV_REST_API_TOKEN` (sandbox Square keys to start — see Step 1)
3. Test a full checkout with a Square sandbox card
4. When ready for real charges, swap to the Production Access Token + Location ID and switch `SQUARE_ENVIRONMENT` to `production`
5. Connect your domain
