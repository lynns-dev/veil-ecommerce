// Square Subscriptions API — "Subscribe & Save" on single-jar fragrances,
// every 60 days, 15% off (lib/products.js's SUBSCRIPTION_* constants).
//
// Field names, request shapes, and the Catalog object model here (the
// separate SUBSCRIPTION_PLAN vs SUBSCRIPTION_PLAN_VARIATION objects, a
// plan variation's `phases[].recurringPriceMoney`/`cadence`,
// CreateSubscriptionRequest's planVariationId/customerId/cardId/source,
// CreateCustomerRequest's givenName/familyName/emailAddress/address,
// CreateCardRequest's sourceId/card.customerId) are confirmed directly
// against the installed SDK's own TypeScript definitions
// (node_modules/square/api/**/*.d.ts), the same standard
// lib/squareServer.js's own header describes — not guessed.
//
// Three moving pieces:
//   1. ensureSubscriptionPlan() — one-time Catalog setup (a single
//      "VEIL Subscribe & Save" plan with one plan variation per
//      subscribable product), cached in KV after the first call so this
//      never runs twice. Whichever request happens to be the very first
//      subscribe attempt on a fresh deployment pays this one-time cost.
//   2. createCustomerAndCard() — Square requires a customer + a card on
//      file (not the single-use token /api/square-checkout charges
//      directly) before a subscription can be created.
//   3. createSquareSubscription() / cancelSquareSubscription() — the
//      subscription itself. Square bills the card immediately on
//      creation and automatically every cadence after — nothing here
//      re-implements that; renewals are entirely Square's own job, and
//      this site just listens for the outcome
//      (pages/api/square-subscription-webhook.js).

import { getSquareClient } from './squareServer';
import { PRODUCTS, SUBSCRIPTION_PRODUCT_IDS, subscriptionPrice, SUBSCRIPTION_CADENCE_DAYS } from './products';
import { getCachedSubscriptionPlan, saveSubscriptionPlan } from './subscriptionsStore';

function errorDetail(err) {
  return err?.errors?.[0]?.detail || err?.errors?.[0]?.code || err?.message || 'Request failed';
}

function toCents(amount) {
  return BigInt(Math.round(Number(amount) * 100));
}

// SIXTY_DAYS is one of Square's fixed day-based cadences (billed relative
// to the subscription's own start_date, not calendar months) — exactly
// matches "every 60 days" with no rounding/approximation needed, unlike
// reaching for MONTHLY/EVERY_TWO_MONTHS.
const CADENCE_BY_DAYS = { 60: 'SIXTY_DAYS' };

function cadenceForDays(days) {
  const cadence = CADENCE_BY_DAYS[days];
  if (!cadence) throw new Error(`No Square cadence mapped for ${days} days.`);
  return cadence;
}

async function createSubscriptionPlanCatalog() {
  const square = getSquareClient();
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error('SQUARE_LOCATION_ID is not set.');

  const planIdemKey = `veil-sub-plan-${Date.now()}`;
  let planResponse;
  try {
    planResponse = await square.catalog.object.upsert({
      idempotencyKey: planIdemKey,
      object: {
        type: 'SUBSCRIPTION_PLAN',
        id: '#veil-subscribe-and-save',
        subscriptionPlanData: { name: 'VEIL Subscribe & Save' },
      },
    });
  } catch (err) {
    console.error('Square subscription plan creation failed:', JSON.stringify(err?.errors || err?.message || err));
    throw new Error(errorDetail(err));
  }
  const planId = planResponse.catalogObject?.id;
  if (!planId) throw new Error('Square did not return a subscription plan id.');

  const cadence = cadenceForDays(SUBSCRIPTION_CADENCE_DAYS);
  const variations = {};
  for (const productId of SUBSCRIPTION_PRODUCT_IDS) {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) continue;
    const price = subscriptionPrice(product.price);
    let variationResponse;
    try {
      // eslint-disable-next-line no-await-in-loop
      variationResponse = await square.catalog.object.upsert({
        idempotencyKey: `veil-sub-var-${productId}-${Date.now()}`,
        object: {
          type: 'SUBSCRIPTION_PLAN_VARIATION',
          id: `#veil-sub-var-${productId}`,
          subscriptionPlanVariationData: {
            name: `${product.name} — Subscribe & Save`,
            subscriptionPlanId: planId,
            phases: [
              {
                cadence,
                recurringPriceMoney: { amount: toCents(price), currency: 'USD' },
              },
            ],
          },
        },
      });
    } catch (err) {
      console.error(`Square subscription plan variation creation failed for ${productId}:`, JSON.stringify(err?.errors || err?.message || err));
      throw new Error(errorDetail(err));
    }
    const variationId = variationResponse.catalogObject?.id;
    if (!variationId) throw new Error(`Square did not return a plan variation id for ${productId}.`);
    variations[productId] = variationId;
  }

  return { planId, variations, locationId };
}

// Cached after the first successful run — every subsequent subscribe
// request just reads the cached ids instead of re-hitting the Catalog API.
export async function ensureSubscriptionPlan() {
  const cached = await getCachedSubscriptionPlan();
  if (cached && SUBSCRIPTION_PRODUCT_IDS.every((id) => cached.variations?.[id])) {
    return cached;
  }
  const plan = await createSubscriptionPlanCatalog();
  await saveSubscriptionPlan(plan);
  return plan;
}

// cardToken: single-use token from lib/squareClient.js's
// tokenizeSquareCard() — same tokenize flow /api/square-checkout already
// uses, just handed to Cards (card-on-file) instead of Payments (one-time
// charge) here.
export async function createCustomerAndCard({ email, name, shipping, cardToken }) {
  const square = getSquareClient();

  const address = shipping
    ? {
        addressLine1: shipping.address || undefined,
        addressLine2: shipping.apt || undefined,
        locality: shipping.city || undefined,
        administrativeDistrictLevel1: shipping.state || undefined,
        postalCode: shipping.zip || undefined,
        country: 'US',
      }
    : undefined;

  let customer;
  try {
    const response = await square.customers.create({
      givenName: name || undefined,
      emailAddress: email,
      address,
      phoneNumber: shipping?.phone || undefined,
      referenceId: 'veil-subscribe-and-save',
    });
    customer = response.customer;
  } catch (err) {
    console.error('Square customer creation failed:', JSON.stringify(err?.errors || err?.message || err));
    throw new Error(errorDetail(err));
  }
  if (!customer?.id) throw new Error('Square did not return a customer id.');

  let card;
  try {
    const response = await square.cards.create({
      idempotencyKey: `veil-sub-card-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      sourceId: cardToken,
      card: {
        cardholderName: name || undefined,
        billingAddress: address,
        customerId: customer.id,
      },
    });
    card = response.card;
  } catch (err) {
    console.error('Square card-on-file creation failed:', JSON.stringify(err?.errors || err?.message || err));
    throw new Error(errorDetail(err));
  }
  if (!card?.id) throw new Error('Square did not return a card id.');

  return { customerId: customer.id, cardId: card.id };
}

export async function createSquareSubscription({ customerId, cardId, planVariationId }) {
  const square = getSquareClient();
  const locationId = process.env.SQUARE_LOCATION_ID;
  if (!locationId) throw new Error('SQUARE_LOCATION_ID is not set.');

  let subscription;
  try {
    const response = await square.subscriptions.create({
      idempotencyKey: `veil-sub-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      locationId,
      planVariationId,
      customerId,
      cardId,
      source: { name: 'VEIL Website' },
    });
    subscription = response.subscription;
  } catch (err) {
    console.error('Square subscription creation failed:', JSON.stringify(err?.errors || err?.message || err));
    throw new Error(errorDetail(err));
  }
  if (!subscription?.id) throw new Error('Square did not return a subscription id.');
  return subscription;
}

export async function cancelSquareSubscription(subscriptionId) {
  const square = getSquareClient();
  try {
    const response = await square.subscriptions.cancel({ subscriptionId });
    return response.subscription;
  } catch (err) {
    console.error('Square subscription cancel failed:', JSON.stringify(err?.errors || err?.message || err));
    throw new Error(errorDetail(err));
  }
}
