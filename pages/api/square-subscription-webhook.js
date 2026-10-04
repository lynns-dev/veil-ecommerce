// Square Subscriptions/Invoices webhook — the *authoritative* source for
// subscription revenue, same principle as pages/api/shop-pay/webhook.js:
// Square bills the card itself on the schedule its Subscriptions API owns
// (see lib/squareSubscriptionsServer.js), so the only way this site finds
// out a renewal actually happened (or failed) is by listening here, not by
// running its own billing cron.
//
// bodyParser is disabled so this sees the exact raw bytes Square signed —
// WebhooksHelper.verifySignature (confirmed against the installed SDK's
// own node_modules/square/wrapper/WebhooksHelper.d.ts) needs the raw
// string, and needs `notificationUrl` to exactly match the URL configured
// for this webhook subscription in the Square Developer Dashboard
// (SQUARE_SUBSCRIPTION_WEBHOOK_URL — see .env.example).
//
// Deliberately does NOT run the full fulfillOrder() pipeline
// (lib/orderFulfillment.js) that one-time checkouts use — that pipeline
// fires a CAPI Purchase event and starts the email app's "order_received"
// thank-you/review-nudge automation, both of which make sense once per
// customer but not once per 60-day renewal. Renewals only need to land in
// the revenue ledger (recordOrder) so they show up in admin's Orders tab
// and Revenue figures. The one exception is the Meta Purchase for the
// FIRST charge (sendFirstChargePurchase below) — the conversion the ad
// actually drove — sent once per subscription, never for a renewal.

import { WebhooksHelper } from 'square';
import { recordOrder } from '../../lib/analyticsStore';
import { findSubscription, updateSubscription, markInvoiceProcessed, invoiceAlreadyProcessed } from '../../lib/subscriptionsStore';
import { sendPushToAdmins } from '../../lib/webPush';
import { sendCapiEvent, buildUserData } from '../../lib/metaCapi';
import { lookupMetaClick } from '../../lib/metaClickStore';

export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Server-side half of the subscription's Meta Purchase, paired by eventId
// with the browser Pixel's Purchase fired by components/SubscribeModal.jsx.
// Sent from here rather than /api/subscribe.js so it only ever reports a
// charge Square actually collected. Everything about the shopper comes from
// sub.meta, captured from their own request at signup (pages/api/subscribe.js)
// — this request is Square's. Subscriptions created before that capture
// existed have no sub.meta and are skipped.
async function sendFirstChargePurchase(sub, invoice) {
  const meta = sub.meta;
  if (!meta?.eventId || sub.metaPurchaseSentAt) return;
  // Clicked the ad in another browser — look the click up by email/phone
  // (lib/metaClickStore.js).
  const remembered = meta.fbc ? null : await lookupMetaClick({ email: sub.email, phone: sub.shipping?.phone });
  await sendCapiEvent({
    eventName: 'Purchase',
    eventId: meta.eventId,
    eventSourceUrl: meta.url || undefined,
    userData: buildUserData({
      clientIp: meta.clientIp,
      userAgent: meta.userAgent,
      fbc: meta.fbc || remembered?.fbc,
      fbp: meta.fbp || remembered?.fbp,
      email: sub.email,
      phone: sub.shipping?.phone,
      externalId: meta.sessionId || undefined,
    }),
    customData: {
      currency: 'USD',
      value: sub.price,
      order_id: invoice.id,
      content_type: 'product',
      content_ids: [sub.productId],
      contents: [{ id: sub.productId, quantity: 1, item_price: sub.price }],
      num_items: 1,
    },
  });
  await updateSubscription(sub.id, { metaPurchaseSentAt: new Date().toISOString() });
}

async function handleInvoicePaymentMade(invoice) {
  const subscriptionId = invoice?.subscriptionId;
  if (!subscriptionId) return; // a non-subscription invoice — nothing for this route to do.

  const sub = await findSubscription(subscriptionId);
  if (!sub) {
    // Known gap: if this webhook somehow arrives before /api/subscribe.js's
    // own addSubscription() write lands (both happen right after the same
    // CreateSubscription call), there's nothing here yet to attribute the
    // charge to. Rare — KV writes are fast relative to a webhook round
    // trip — and not worth blocking/retrying indefinitely over, so this
    // just logs and moves on rather than returning a retry-inducing 500.
    console.warn('Square subscription webhook: no local record for subscription', subscriptionId);
    return;
  }
  if (invoiceAlreadyProcessed(sub, invoice.id)) return; // already recorded — webhook delivery isn't guaranteed exactly-once.

  await recordOrder({
    id: invoice.id,
    amount: sub.price,
    items: [{ id: sub.productId, name: sub.productName, price: sub.price, quantity: 1 }],
    paymentMethod: 'Square (Subscription)',
    attribution: null,
    createdAt: new Date().toISOString(),
    email: sub.email,
    shipping: sub.shipping || null,
    processor: 'square-subscription',
    status: 'paid',
  });
  await markInvoiceProcessed(subscriptionId, invoice.id);
  try {
    await sendFirstChargePurchase(sub, invoice);
  } catch (err) {
    console.error('Square subscription webhook: Meta Purchase failed:', err);
  }

  sendPushToAdmins({
    title: 'Subscription renewed',
    body: `${sub.productName} · $${Number(sub.price).toFixed(2)} · ${sub.email}`,
    url: '/admin',
  }).catch(() => {});
}

async function handleInvoiceScheduledChargeFailed(invoice) {
  const subscriptionId = invoice?.subscriptionId;
  if (!subscriptionId) return;
  const sub = await findSubscription(subscriptionId);
  if (!sub) return;

  await updateSubscription(subscriptionId, { lastPaymentFailedAt: new Date().toISOString() });
  sendPushToAdmins({
    title: 'Subscription payment failed',
    body: `${sub.productName} · ${sub.email}`,
    url: '/admin',
  }).catch(() => {});
}

async function handleSubscriptionUpdated(subscription) {
  if (!subscription?.id) return;
  const sub = await findSubscription(subscription.id);
  if (!sub) return;
  await updateSubscription(subscription.id, { status: subscription.status || sub.status });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const rawBody = await readRawBody(req);

  const signatureKey = process.env.SQUARE_SUBSCRIPTION_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_SUBSCRIPTION_WEBHOOK_URL;
  if (!signatureKey || !notificationUrl) {
    console.error('Square subscription webhook: SQUARE_SUBSCRIPTION_WEBHOOK_SIGNATURE_KEY / SQUARE_SUBSCRIPTION_WEBHOOK_URL are not set.');
    return res.status(500).end();
  }

  let verified;
  try {
    verified = await WebhooksHelper.verifySignature({
      requestBody: rawBody,
      signatureHeader: req.headers['x-square-hmacsha256-signature'],
      signatureKey,
      notificationUrl,
    });
  } catch (err) {
    console.error('Square subscription webhook verification error:', err.message);
    return res.status(500).end();
  }
  if (!verified) {
    console.error('Square subscription webhook: signature verification failed — rejecting.');
    return res.status(401).end();
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('Square subscription webhook: malformed JSON body.');
    return res.status(400).end();
  }

  try {
    switch (event.type) {
      case 'invoice.payment_made':
        await handleInvoicePaymentMade(event.data?.object?.invoice);
        break;
      case 'invoice.scheduled_charge_failed':
        await handleInvoiceScheduledChargeFailed(event.data?.object?.invoice);
        break;
      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data?.object?.subscription);
        break;
      default:
        // Not a subscription-relevant event — acknowledge and ignore
        // rather than erroring, so Square doesn't keep retrying it.
        break;
    }
    return res.status(200).end();
  } catch (err) {
    console.error('Square subscription webhook: handler failed:', err);
    return res.status(500).end(); // non-200 so Square retries this delivery.
  }
}
