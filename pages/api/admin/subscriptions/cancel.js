// Admin-only cancel — there's no customer self-serve portal yet, so this
// is currently the only way a "Subscribe & Save" subscription stops.
// Square itself still owns the actual cancellation semantics (the
// subscription stays ACTIVE through the end of its current paid period,
// per CancelSubscription's own behavior); the local record just mirrors
// whatever subscription.updated reports back afterward, same as the
// status this route sets directly below.

import { cancelSquareSubscription } from '../../../../lib/squareSubscriptionsServer';
import { updateSubscription } from '../../../../lib/subscriptionsStore';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { subscriptionId } = req.body || {};
  if (!subscriptionId) return res.status(400).json({ error: 'subscriptionId is required.' });

  try {
    const cancelled = await cancelSquareSubscription(subscriptionId);
    const updated = await updateSubscription(subscriptionId, {
      status: cancelled?.status || 'CANCELED',
      canceledAt: new Date().toISOString(),
    });
    if (!updated) return res.status(404).json({ error: 'Subscription not found locally (cancelled in Square, though).' });
    return res.status(200).json({ subscription: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
