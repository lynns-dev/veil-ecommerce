// Called when the shopper clicks the Amazon Pay button: stores the order
// as a pending record and returns the signed checkout-session payload the
// button redirects to Amazon with (lib/amazonPay.js). Trusts the
// client-supplied amount the same way /api/qb-checkout does.
import { amazonPayConfig, buildButtonConfig, newRef, savePending } from '../../../lib/amazonPay';

function siteBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!amazonPayConfig().enabled) return res.status(404).json({ error: 'Amazon Pay is not available.' });

  try {
    const { amount, items, email, shipping, eventId, url, attribution, sessionId, shippingProtection, storeName } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'No items in cart' });

    const ref = newRef();
    await savePending(ref, {
      amount: Number(amount), items, email: email || '', shipping: shipping || null,
      eventId: eventId || null, url: url || null, attribution: attribution || null,
      sessionId: sessionId || null, shippingProtection: Number(shippingProtection) > 0 ? Number(shippingProtection) : 0,
      createdAt: new Date().toISOString(),
    });
    return res.status(200).json(buildButtonConfig({
      ref, amount, baseUrl: siteBaseUrl(req), storeName: String(storeName || 'Checkout').slice(0, 50),
    }));
  } catch (err) {
    console.error('Amazon Pay session error:', err);
    return res.status(500).json({ error: 'Amazon Pay is unavailable right now — please pay by card.' });
  }
}
