// Browser-side hook from the checkout pages into this store's email system
// (lib/email/). Kept free of server-only imports since checkout pages
// bundle it; the server-side order hooks live in lib/email/orderHooks.js.

// Records the email typed at checkout (with its marketing-consent flag) so
// the abandoned_checkout automation can follow up if the order isn't
// completed. Fire-and-forget: tracking never blocks the checkout itself.
export function captureCheckoutEmail({ email, consent, cartValue, items }) {
  if (typeof window === 'undefined' || !email) return;
  fetch('/api/email/checkout-capture', {
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
