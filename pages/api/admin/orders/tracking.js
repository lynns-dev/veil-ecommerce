// Saves a tracking number for an order and emails the customer, in one
// admin action. The email send (lib/emailPlatform.js's notifyOrderShipped)
// is best-effort from this route's point of view — a failure there
// doesn't roll back the tracking info, which is real and worth keeping
// regardless, but it IS reported back to admin (emailSent/emailError) so
// they know to resend or reach the customer another way, unlike the
// silent-by-design notifyOrderReceived call in orderFulfillment.js.

import { updateOrderStatus } from '../../../../lib/analyticsStore';
import { notifyOrderShipped } from '../../../../lib/emailPlatform';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId, carrier, trackingNumber, trackingUrl } = req.body || {};
  if (!orderId || !trackingNumber || !trackingNumber.trim()) {
    return res.status(400).json({ error: 'orderId and trackingNumber are required.' });
  }

  try {
    const updated = await updateOrderStatus(orderId, {
      trackingNumber: trackingNumber.trim(),
      carrier: carrier?.trim() || null,
      trackingUrl: trackingUrl?.trim() || null,
      shippedAt: new Date().toISOString(),
    });
    if (!updated) return res.status(404).json({ error: 'Order not found.' });

    let emailSent = false;
    let emailError = null;
    try {
      await notifyOrderShipped({
        email: updated.email,
        orderId: updated.id,
        carrier: updated.carrier,
        trackingNumber: updated.trackingNumber,
        trackingUrl: updated.trackingUrl,
      });
      emailSent = true;
    } catch (err) {
      emailError = err.message;
    }

    return res.status(200).json({ order: updated, emailSent, emailError });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
