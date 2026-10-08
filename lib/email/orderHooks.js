// Server-side order events -> this store's email system. Replaces the
// HTTP calls to the separate email app (its /api/email/order-received and
// /api/email/order-shipped endpoints) with direct calls.

import { addSubscriberManually, touchLastOrder } from './subscribersStore';
import { sendTransactionalEmail } from './resendEmail';
import { renderOrderShippedEmail } from './orderShippedEmail';
import { getSettings } from './settingsStore';

// A completed order: makes sure the buyer is on the list, records the
// purchase time, and stops abandoned_checkout / add_to_cart for them
// (touchLastOrder) while starting a fresh order_received cycle. Never
// throws — a successful charge must not be reported as failed over this.
export async function notifyOrderReceived(email, timestampMs = Date.now()) {
  if (!email) return;
  try {
    await addSubscriberManually(email, 'order').catch((err) => console.error('Subscriber add failed (order):', err.message));
    await touchLastOrder(email, timestampMs);
  } catch (err) {
    console.error('Email order hook failed:', err.message);
  }
}

// Shipping notice (transactional, so no unsubscribe header). Throws so the
// admin's "Save & email customer" button can show what went wrong.
export async function notifyOrderShipped({ email, orderId, carrier, trackingNumber, trackingUrl }) {
  if (!email) throw new Error('This order has no email on file.');
  if (!trackingNumber) throw new Error('A tracking number is required.');
  const settings = await getSettings().catch(() => ({}));
  const html = renderOrderShippedEmail({ orderId, carrier, trackingNumber, trackingUrl, settings });
  return sendTransactionalEmail({ to: email, subject: 'Your order has shipped!', html });
}
