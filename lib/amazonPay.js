// Amazon Pay (Checkout v2) — an alternative to the QuickBooks card form on
// /checkout and /offer3. Server side only: signs the checkout-session
// payload the button needs, and completes the charge when Amazon sends the
// shopper back (pages/amazon-pay/return.jsx -> /api/amazon-pay/complete).
// Signing and API calls go through Amazon's own SDK.
//
// Flow ("Pay only", ProcessOrder mode): the site already has the shipping
// address and total, so the Amazon sheet only picks a payment method.
//   1. Button click -> POST /api/amazon-pay/session stores the order as a
//      pending record (KV, keyed by a random ref) and returns the signed
//      payload; checkout.js redirects to Amazon.
//   2. Amazon redirects back to /amazon-pay/return?ref=…&amazonCheckoutSessionId=…
//   3. /api/amazon-pay/complete charges it (completeCheckoutSession) and runs
//      the same fulfillOrder() pipeline as every other processor.
//
// Hidden entirely unless all four AMAZON_PAY_* env vars are set. The
// private key is the PEM file Amazon issues with the public key ID — paste
// its full contents into Vercel; never commit it.

import crypto from 'crypto';
import { WebStoreClient } from '@amazonpay/amazon-pay-api-sdk-nodejs';

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const PENDING_TTL_SECONDS = 24 * 60 * 60;
export const SIGNATURE_ALGORITHM = 'AMZN-PAY-RSASSA-PSS-V2';

export function amazonPayConfig() {
  const merchantId = process.env.AMAZON_PAY_MERCHANT_ID;
  const storeId = process.env.AMAZON_PAY_STORE_ID;
  const publicKeyId = process.env.AMAZON_PAY_PUBLIC_KEY_ID;
  // Vercel keeps multi-line values, but a key pasted as one line with
  // literal "\n" sequences is common too — accept both.
  const privateKey = (process.env.AMAZON_PAY_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const enabled = Boolean(merchantId && storeId && publicKeyId && privateKey);
  return { enabled, merchantId, storeId, publicKeyId, privateKey };
}

function client() {
  const { publicKeyId, privateKey } = amazonPayConfig();
  // A LIVE-/SANDBOX- prefixed key id already selects the environment, so
  // no sandbox flag is needed.
  return new WebStoreClient({ publicKeyId, privateKey, region: 'us', algorithm: SIGNATURE_ALGORITHM });
}

async function kv(path, body) {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set.');
  const res = await fetch(`${KV_URL}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return res.json();
}

export async function savePending(ref, record) {
  await kv(`set/amazon_pay:pending:${ref}?EX=${PENDING_TTL_SECONDS}`, record);
}

export async function loadPending(ref) {
  if (!/^[a-f0-9-]{36}$/.test(String(ref || ''))) return null;
  const data = await kv(`get/amazon_pay:pending:${ref}`);
  return data.result ? JSON.parse(data.result) : null;
}

export function newRef() {
  return crypto.randomUUID();
}

// The signed payload for amazon.Pay's initCheckout. The exact JSON string
// that was signed must be what the button sends, so both are returned.
export function buildButtonConfig({ ref, amount, baseUrl, storeName }) {
  const { storeId } = amazonPayConfig();
  const payloadJSON = JSON.stringify({
    webCheckoutDetails: {
      checkoutMode: 'ProcessOrder',
      checkoutResultReturnUrl: `${baseUrl}/amazon-pay/return?ref=${ref}`,
    },
    storeId,
    chargePermissionType: 'OneTime',
    paymentDetails: {
      paymentIntent: 'AuthorizeWithCapture',
      chargeAmount: { amount: Number(amount).toFixed(2), currencyCode: 'USD' },
      presentmentCurrency: 'USD',
    },
    merchantMetadata: { merchantReferenceId: ref.slice(0, 32), merchantStoreName: storeName },
    scopes: ['name', 'email'],
  });
  return { payloadJSON, signature: client().generateButtonSignature(payloadJSON), algorithm: SIGNATURE_ALGORITHM };
}

// Confirms the buyer's checkout and captures the charge. Resolves to the
// Amazon checkout session; throws with Amazon's own message on failure.
export async function completeCheckout(checkoutSessionId, amount) {
  try {
    const res = await client().completeCheckoutSession(
      checkoutSessionId,
      { chargeAmount: { amount: Number(amount).toFixed(2), currencyCode: 'USD' } },
      { 'x-amz-pay-idempotency-key': checkoutSessionId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32) }
    );
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    throw new Error(data?.message || data?.reasonCode || err.message || 'Amazon Pay could not complete this payment.');
  }
}

// Full refund of an Amazon Pay charge, for admin's Refund button
// (pages/api/admin/orders/refund.js). The order id is Amazon's charge id.
export async function refundCharge(chargeId, amount) {
  try {
    const res = await client().createRefund(
      { chargeId, refundAmount: { amount: Number(amount).toFixed(2), currencyCode: 'USD' }, softDescriptor: 'REFUND' },
      { 'x-amz-pay-idempotency-key': `refund-${chargeId}`.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 32) }
    );
    return res.data;
  } catch (err) {
    const data = err.response?.data;
    throw new Error(data?.message || data?.reasonCode || err.message || 'Amazon Pay refund failed.');
  }
}
