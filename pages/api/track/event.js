// Public, fire-and-forget funnel event tracking. Never throws in a way that
// would surface to the visitor — a lost analytics ping shouldn't affect
// their experience.

import { incrementEvent, logEvent } from '../../../lib/analyticsStore';

const ALLOWED = ['pageview', 'addtocart', 'checkout_start'];
// Logged to the timestamped recent-events feed for the live-activity view.
// pageview is excluded — too high-volume to be useful there.
const LOGGED = ['addtocart', 'checkout_start'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { event, productName } = req.body || {};
  if (ALLOWED.includes(event)) {
    try {
      await incrementEvent(event);
      if (LOGGED.includes(event)) await logEvent(event, productName ? { productName } : {});
    } catch (err) {
      console.error('Event tracking failed:', err);
    }
  }

  return res.status(204).end();
}
