// Generic lead capture — fired when someone fills in their email (and,
// depending on the source, a phone number) at checkout or through a
// popup like the "Reveal Your Reserve" scratch card, before necessarily
// completing an order. Records them so they aren't lost if they never
// finish/never buy; lib/orderFulfillment.js upgrades the same entry to
// 'purchased' if they do go on to place an order. Fire-and-forget like
// /api/track/event — a lost capture shouldn't affect the visitor's
// checkout or popup experience.

import { recordLead } from '../../lib/checkoutLeadsStore';
import { resolveClickIds } from '../../lib/metaCapi';
import { rememberMetaClick } from '../../lib/metaClickStore';

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
  // The moment an email is typed is often the only point where the ad click
  // (this browser's _fbc) and the shopper's identity are seen together —
  // saved so a purchase made later in a different browser can still carry
  // the ClickID (lib/metaClickStore.js).
  await rememberMetaClick({ email, phone, ...resolveClickIds(req) });

  return res.status(204).end();
}
