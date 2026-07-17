// The authoritative source of truth for "did this order actually get
// paid." Payment Element supports methods that redirect off-site (Afterpay,
// Amazon Pay) where the shopper's browser might never make it back to
// /success — closed tab, crashed connection, whatever. A webhook is the
// only reliable way to catch that a payment succeeded regardless of what
// happened to the browser afterward, so this is what actually calls
// fulfillOrder(), not any client-triggered request.
//
// Register this URL (https://YOUR_DOMAIN/api/stripe/webhook) in the Stripe
// Dashboard under Developers > Webhooks, subscribed to payment_intent.succeeded,
// and put the resulting signing secret in STRIPE_WEBHOOK_SECRET.

import { getStripe } from '../../../lib/stripeServer';
import { getPendingOrder, deletePendingOrder } from '../../../lib/stripePendingOrders';
import { fulfillOrder } from '../../../lib/orderFulfillment';

export const config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set.');
    return res.status(500).end();
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    return res.status(500).end();
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    try {
      const pending = await getPendingOrder(intent.id);
      if (pending) {
        await fulfillOrder({
          id: intent.id,
          amount: pending.amount,
          items: pending.items,
          eventId: pending.eventId,
          url: pending.url,
          req,
          paymentMethod: pending.paymentMethod,
          attribution: pending.attribution,
        });
        await deletePendingOrder(intent.id);
      }
      // No pending record means this was already fulfilled (a redelivered
      // event) or the intent never went through /api/stripe/update-intent —
      // either way, nothing left to do.
    } catch (err) {
      console.error('Stripe webhook fulfillment failed:', err);
      return res.status(500).end();
    }
  }

  return res.status(200).json({ received: true });
}
