// Called when the shopper clicks the Afterpay button: stores the order as a
// pending record and creates the Afterpay checkout (lib/afterpay.js), then
// returns the URL to send the shopper to. Trusts the client-supplied amount
// the same way /api/qb-checkout and /api/amazon-pay/session do.
import { afterpayConfig, createCheckout, getOrderLimits, newRef, savePending } from '../../../lib/afterpay';

function siteBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!afterpayConfig().enabled) return res.status(404).json({ error: 'Afterpay is not available.' });

  try {
    const { amount, items, email, shipping, eventId, url, attribution, sessionId, shippingProtection } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items in cart' });
    if (!email) return res.status(400).json({ error: 'Enter your email before paying with Afterpay.' });

    const { min, max } = await getOrderLimits();
    if (Number(amount) < min || Number(amount) > max) {
      return res.status(400).json({ error: `Afterpay is available for orders from $${min.toFixed(2)} to $${max.toFixed(2)}.` });
    }

    const ref = newRef();
    const pending = {
      amount: Number(amount), items, email, shipping: shipping || null,
      eventId: eventId || null, url: url || null, attribution: attribution || null,
      sessionId: sessionId || null, shippingProtection: Number(shippingProtection) > 0 ? Number(shippingProtection) : 0,
      createdAt: new Date().toISOString(),
    };
    const { token, redirectCheckoutUrl } = await createCheckout({ ref, pending, baseUrl: siteBaseUrl(req) });
    await savePending(ref, { ...pending, token });
    return res.status(200).json({ redirectCheckoutUrl });
  } catch (err) {
    console.error('Afterpay checkout error:', err.message);
    return res.status(500).json({ error: 'Afterpay is unavailable right now — please pay by card.' });
  }
}
