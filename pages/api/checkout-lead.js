// Fired when someone fills in their email during checkout (any entry point
// — /checkout, /offer3) but hasn't necessarily completed the order yet.
// Records them as an 'abandoned' lead so they aren't lost if they never
// finish; lib/orderFulfillment.js upgrades the same entry to 'purchased'
// if they do. Fire-and-forget like /api/track/event — a lost capture
// shouldn't affect the visitor's checkout experience.

import { recordLead } from '../../lib/checkoutLeadsStore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { email, cart, source, sessionId, url } = req.body || {};
  try {
    await recordLead({ email, cart, source, sessionId, url });
  } catch (err) {
    console.error('Checkout lead capture failed:', err);
  }

  return res.status(204).end();
}
