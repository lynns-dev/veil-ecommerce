// Generic lead capture — fired when someone fills in their email (and,
// depending on the source, a phone number) at checkout or through a
// popup like the "Reveal Your Reserve" scratch card, before necessarily
// completing an order. Records them so they aren't lost if they never
// finish/never buy; lib/orderFulfillment.js upgrades the same entry to
// 'purchased' if they do go on to place an order. Fire-and-forget like
// /api/track/event — a lost capture shouldn't affect the visitor's
// checkout or popup experience.

import { recordLead } from '../../lib/checkoutLeadsStore';

const ALLOWED_STATUSES = ['abandoned', 'subscribed'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { email, phone, cart, source, sessionId, url, status } = req.body || {};
  try {
    await recordLead({
      email,
      phone,
      cart,
      source,
      sessionId,
      url,
      ...(ALLOWED_STATUSES.includes(status) ? { status } : {}),
    });
  } catch (err) {
    console.error('Lead capture failed:', err);
  }

  return res.status(204).end();
}
