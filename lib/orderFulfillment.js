// Shared post-payment side effects for every checkout path (QuickBooks card
// charges, PayPal captures, ...): order ledger entry, funnel counters, admin
// push notification, and the server-side Meta Purchase event. Failures here
// are logged but never thrown — a successful charge/capture must not be
// undone or reported as failed just because a notification write hiccuped.

import { recordOrder, incrementEvent, logEvent } from './analyticsStore';
import { sendPushToAdmins } from './webPush';
import { sendCapiEvent, getRequestUserData } from './metaCapi';

export async function fulfillOrder({ id, amount, items, eventId, url, req, paymentMethod }) {
  try {
    await recordOrder({ id, amount, items, paymentMethod: paymentMethod || 'Unknown', createdAt: new Date().toISOString() });
    await incrementEvent('purchase');
    await logEvent('purchase', { amount });
    const itemCount = items.length;
    await sendPushToAdmins({
      title: 'New order',
      body: `$${Number(amount).toFixed(2)} — ${itemCount} item${itemCount === 1 ? '' : 's'}`,
      url: '/admin',
    });
    if (eventId) {
      await sendCapiEvent({
        eventName: 'Purchase',
        eventId,
        eventSourceUrl: url,
        userData: getRequestUserData(req),
        customData: {
          currency: 'USD',
          value: amount,
          content_ids: items.map((i) => i.id),
          contents: items.map((i) => ({ id: i.id, quantity: i.quantity })),
        },
      });
    }
  } catch (err) {
    console.error('Order/analytics recording failed:', err);
  }
}
