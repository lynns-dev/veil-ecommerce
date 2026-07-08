# VEIL Full E-Commerce Site — Deployment Guide

This is a complete, production-ready Next.js e-commerce website with full product catalog, detailed product pages, shopping cart, and direct Stripe payment processing. Built entirely in VEIL's quiet-luxury aesthetic.

## What You Get

- **Homepage** with hero, featured products, brand story, and value proposition
- **Product catalog page** with all VEIL offerings
- **Individual product detail pages** with full descriptions, scent notes, and product specifications
- **Shopping cart** (persistent across pages, sticky sidebar)
- **Direct Stripe checkout** (no Shopify, no platform lock-in)
- **Instant payouts enabled** = funds to your bank in ~30 minutes
- **Deployed to Vercel** (free, automatic scaling, HTTPS included)
- **Custom domain** pointing from Squarespace
- **VEIL brand aesthetic throughout** (Fraunces serif, warm white, quiet luxury)

---

## Step 1: Get Your Stripe Secret Key

1. Go to https://dashboard.stripe.com
2. Click "Developers" in the left menu
3. Click "API Keys"
4. Copy your **Secret Key** (starts with `sk_live_`)
5. Keep this private — never share it publicly

---

## Step 2: Deploy to Vercel

### Option A: Quick Deploy (Recommended)

1. Go to https://vercel.com and sign up (or log in with GitHub)
2. Click "New Project" → "Import Git Repository"
3. Paste this repo URL: `https://github.com/[your-repo-url]`
   - *Or upload these files as a Git repo first*
4. Click "Deploy"
5. After deployment, go to "Settings" → "Environment Variables"
6. Add these two variables:
   - `STRIPE_SECRET_KEY`: Paste your Secret Key from Step 1
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_live_51TqLmiF76L8KlDvJdIvdRTV0h5KsaIdGgKWjyeWmvirKIjAEBNr3VXF8mBEzNCXKuHtoGBA2ecm3bd2bWLoC4Z2X00Y250F3eD` (already in the code)
   - `NEXT_PUBLIC_BASE_URL`: Your Vercel domain (e.g., `https://veil-checkout.vercel.app`)
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

## Step 4: Enable Instant Payouts (Stripe)

1. Go to https://dashboard.stripe.com
2. Click "Payouts" in the left menu
3. Go to "Payout Schedule" tab
4. If eligible, you'll see "Instant payouts" option
5. Enable it — funds hit your bank in ~30 minutes instead of 2 days

---

## Step 5: Test the Checkout

1. Go to your deployed domain (e.g., `https://checkout.veilpuff.com`)
2. Add a product to the cart
3. Click "Proceed to Stripe Checkout"
4. Use Stripe's test card: `4242 4242 4242 4242`, any future expiry, any 3-digit CVC
5. Check your Stripe dashboard — payment should appear immediately

---

## Customizing Products

All products are hardcoded in `pages/index.jsx` in the `PRODUCTS` array.

To change them:
1. Edit `pages/index.jsx`
2. Update product names, prices, images, descriptions
3. Push to GitHub (or redeploy to Vercel)
4. Changes go live automatically

Example product entry:
```javascript
{
  id: 'citron',
  name: 'Citron Lumineaux',
  price: 58,
  image: 'https://your-image-url.jpg',
  description: 'Bright citrus-forward scent',
}
```

---

## Site Structure

### Pages
- `/` — Homepage with hero, featured products, brand story
- `/shop` — Full product catalog
- `/product/[id]` — Individual product detail pages (Citron, Original, Violette, etc.)
- `/success` — Order confirmation page

### Components
- `Header.jsx` — Navigation, cart button, logo
- `Product data` at `lib/products.js` — All product information, descriptions, scent notes

### Architecture
- **Frontend**: Next.js React app (all pages)
- **Backend**: Vercel serverless function at `/api/checkout` (creates Stripe sessions securely)
- **Payments**: Stripe (processes transactions, handles instant payouts)
- **Hosting**: Vercel (free tier handles all traffic)
- **Database**: None (stateless — cart data lives in browser memory)

---

## Security Notes

- Your **Secret Key** is only in Vercel's environment variables (never in code)
- Your **Publishable Key** is safe in the code (it's meant to be public)
- Stripe handles PCI compliance (you never see card numbers)
- HTTPS is automatic (Vercel provides free SSL)

---

## Troubleshooting

**"Checkout failed" error:**
- Check that `STRIPE_SECRET_KEY` is correct in Vercel environment variables
- Verify the key hasn't been revoked in Stripe dashboard

**Domain not connecting:**
- DNS can take 24–48 hours to propagate
- Check Vercel's domain status (should show green ✓)

**Products not showing:**
- Check image URLs are valid and publicly accessible
- Stripe test requires valid HTTPS images

**Instant payouts not available:**
- Stripe requires account age + processing history
- Contact Stripe support if you think you're eligible

---

## Next Steps

1. Deploy this to Vercel
2. Add your Stripe Secret Key
3. Connect your domain
4. Enable instant payouts
5. Test with a test transaction
6. Go live 🚀

You now have a checkout that Shopify can't touch, with funds hitting your bank in 30 minutes.

---

**Questions?** Reply here or contact Stripe support.
