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

// `items` is whatever's in useCart's `cart` (full product objects +
// quantity) — trimmed down to just what the email app's abandoned-
// checkout automation actually renders (lib/emailBlocks.js's
// renderCartItemsHtml), so an abandoned-cart email can show the real
// products instead of staying generic.
export function captureCheckoutEmail({ email, consent, cartValue, items }) {
  const base = process.env.NEXT_PUBLIC_EMAIL_APP_URL;
  if (!base || !email) return;
  fetch(`${base}/api/email/checkout-capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      consent: Boolean(consent),
      cartValue: Number(cartValue) || 0,
      items: Array.isArray(items)
        ? items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, price: i.price, image: i.images?.[0] }))
        : [],
    }),
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

// Sends the "your order has shipped" email, called from
// pages/api/admin/orders/tracking.js the moment admin saves a tracking
// number for an order. Unlike the two functions above, this deliberately
// does NOT swallow its own errors — admin is taking an explicit action
// whose entire point is "send this email," so the caller needs to know if
// it failed (and show that to admin) rather than have it silently no-op.
export async function notifyOrderShipped({ email, orderId, carrier, trackingNumber, trackingUrl }) {
  const base = process.env.NEXT_PUBLIC_EMAIL_APP_URL;
  const secret = process.env.EMAIL_APP_WEBHOOK_SECRET;
  if (!base || !secret) throw new Error('Email app is not configured (NEXT_PUBLIC_EMAIL_APP_URL / EMAIL_APP_WEBHOOK_SECRET).');
  if (!email) throw new Error('This order has no email on file.');

  const res = await fetch(`${base}/api/email/order-shipped`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ email, orderId, carrier, trackingNumber, trackingUrl }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Email app returned ${res.status}.`);
  }
}
