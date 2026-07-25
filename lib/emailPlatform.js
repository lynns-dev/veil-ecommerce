// Connects this storefront to the separate email/subscriber platform
// (lynns-dev/email — a standalone app, not part of this repo). Two
// directions:
//
// - captureCheckoutEmail(): client-side, called from checkout.jsx/
//   checkout-qb.jsx's email field on blur. Cross-origin fetch straight to
//   the email app's /api/email/checkout-capture (public, CORS-gated on
//   that app's ALLOWED_ORIGINS — this site's origin needs to be in that
//   list for these calls to succeed). Adds/updates a subscriber and starts
//   its abandoned_checkout automation; a no-consent call is a deliberate
//   no-op there, not an error here.
// - notifyOrderReceived(): server-side, called from lib/orderFulfillment.js
//   right after a charge captures. Bearer-token protected
//   (EMAIL_APP_WEBHOOK_SECRET, matching that app's STOREFRONT_WEBHOOK_SECRET)
//   since — unlike the checkout capture above — a forged call here could
//   suppress a real cart-recovery send. Stops abandoned_checkout and starts
//   order_received for that subscriber; without this, a customer who
//   already paid would keep getting "finish your order" emails, since
//   nothing else tells that app this storefront's checkout converted (it
//   isn't Shopify, so there's no orders/create webhook covering this).
//
// Both are best-effort — a down/misconfigured email app must never affect
// checkout or fulfillment, so every call here swallows its own errors.

export function captureCheckoutEmail({ email, consent, cartValue }) {
  const base = process.env.NEXT_PUBLIC_EMAIL_APP_URL;
  if (!base || !email) return;
  fetch(`${base}/api/email/checkout-capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, consent: Boolean(consent), cartValue: Number(cartValue) || 0 }),
    keepalive: true,
  }).catch(() => {});
}

export async function notifyOrderReceived(email) {
  const base = process.env.NEXT_PUBLIC_EMAIL_APP_URL;
  const secret = process.env.EMAIL_APP_WEBHOOK_SECRET;
  if (!base || !secret || !email) return;
  try {
    await fetch(`${base}/api/email/order-received`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify({ email }),
    });
  } catch {
    // best-effort — see file header
  }
}
