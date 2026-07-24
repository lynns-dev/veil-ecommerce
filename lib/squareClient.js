// Square Web Payments SDK — client-side tokenization for Card, Apple Pay,
// Google Pay, and Afterpay/Clearpay.
//
// Unlike Stripe's @stripe/stripe-js (an npm package), Square's Web Payments
// SDK is a plain script tag that attaches a `Square` global — loadSquare()
// injects it once and caches the promise, same shape as loadStripe().
// NEXT_PUBLIC_SQUARE_ENVIRONMENT picks which CDN script/API host to use;
// it must match the account the access token and location ID belong to,
// same requirement as Stripe's publishable/secret key pairing.
//
// Card.tokenize() flow (payments.card() -> attach -> tokenize) confirmed
// against Square's own "Take a Card Payment" docs. Apple Pay, Google Pay,
// and Afterpay/Clearpay below were NOT verified against primary Square docs
// this session (developer.squareup.com is blocked from this environment) —
// built from Square's public SDK reference via search results and a
// third-party open-source wrapper's source (weareseeed/
// react-square-web-payments-sdk), which confirmed Afterpay follows the same
// click-button -> tokenize() -> await tokenResult shape as Apple/Google Pay
// (presented in a popup, not a full-page redirect), not the event-based
// flow Cash App Pay needed. Each wallet is wrapped so a failure to
// initialize (unsupported browser/device, that wallet not enabled on the
// Square account, order total outside Afterpay's eligible range, etc.)
// never breaks the rest of checkout — the calling page just doesn't show
// that button. The server-side CreatePayment call every token gets sent to
// (lib/squareServer.js) is also unverified — treat all of this as
// unverified until a real charge of each type has gone through end-to-end.
//
// Cash App Pay was removed after a live attempt failed with a generic
// "did not complete" error with no further diagnosis — see git history
// (lib/squareClient.js's createCashAppPayButton) if it's ever revisited.

const SDK_URL = {
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
  production: 'https://web.squarecdn.com/v1/square.js',
};

let loadPromise = null;

function loadSquareScript(environment) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Square SDK can only load in the browser.'));
  if (window.Square) return Promise.resolve(window.Square);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL[environment] || SDK_URL.production;
    script.async = true;
    script.onload = () => (window.Square ? resolve(window.Square) : reject(new Error('Square SDK loaded but window.Square is missing.')));
    script.onerror = () => reject(new Error('Failed to load the Square Web Payments SDK.'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

let paymentsPromise = null;

// Square's `payments` client is the shared entry point every payment method
// (card, wallets) is created from — cached the same way the script itself
// is, since there's never a reason to create more than one per page load.
function getSquarePayments() {
  const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  const environment = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT || 'production';
  if (!appId || !locationId) return Promise.reject(new Error('NEXT_PUBLIC_SQUARE_APPLICATION_ID / NEXT_PUBLIC_SQUARE_LOCATION_ID are not set.'));

  if (!paymentsPromise) {
    paymentsPromise = loadSquareScript(environment).then((Square) => Square.payments(appId, locationId));
  }
  return paymentsPromise;
}

// Resolves to an initialized Square Card instance, already attached to the
// given DOM element id — ready for tokenize() once the shopper submits.
export async function createSquareCard(containerId) {
  const payments = await getSquarePayments();
  const card = await payments.card();
  await card.attach(`#${containerId}`);
  return card;
}

// card: the object returned by createSquareCard(). details: the
// verificationDetails shape from Square's docs — amount (string, e.g.
// '45.00'), currencyCode, intent ('CHARGE'), billingContact, plus
// customerInitiated/sellerKeyedIn flags. Resolves to a single-use payment
// token string; throws with Square's own error detail on failure.
export async function tokenizeSquareCard(card, details) {
  let tokenResult;
  try {
    tokenResult = await card.tokenize(details);
  } catch (err) {
    // card.tokenize() itself throwing (rejecting) rather than resolving
    // with a non-OK status is a distinct failure mode from the one below —
    // previously nothing logged the raw error here, so a generic SDK
    // message like "An unexpected error occurred while using Card" reached
    // the shopper with no way to see what actually caused it. Logging the
    // full error (not just err.message) so the real cause — network,
    // malformed verificationDetails field, environment mismatch, etc. — is
    // visible in the browser console next time this happens.
    console.error('Square card.tokenize() threw:', err);
    throw err;
  }
  if (tokenResult.status === 'OK') {
    return tokenResult.token;
  }
  console.error('Square card tokenize returned non-OK status:', JSON.stringify(tokenResult));
  const detail = tokenResult.errors ? JSON.stringify(tokenResult.errors) : tokenResult.status;
  throw new Error(`Card verification failed: ${detail}`);
}

// Square's BillingContact.phone requires a leading "+" and country code
// ("A leading + symbol (followed by a country code)... must contain
// between 9 and 16 digits" per Square's docs). Our shipping form is a
// plain, unformatted "Phone (optional)" text field, so a normal US number
// typed without a "+1" prefix doesn't match that — the likely cause of a
// real live tokenize() failure ("An unexpected error occurred while using
// Card") traced to a 400 from Square's own pci-connect.squareup.com/v2/
// analytics/verifications endpoint, the buyer-verification request
// tokenize() fires specifically when billingContact is present. That
// lines up with the same card working fine through Google Pay, whose
// tokenize() call (lib/squareClient.js's tokenizeWallet) sends no
// billingContact at all. Normalizes a 10-digit US number to E.164
// (+1XXXXXXXXXX); anything else that doesn't already look like a valid
// +-prefixed number is dropped rather than risking another malformed-field
// rejection — phone is optional here and not load-bearing for the charge
// itself, unlike AVS/CVV.
export function normalizeUsPhoneForSquare(raw) {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 16 ? `+${digits}` : undefined;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return undefined;
}

// Shared by every wallet method below — describes the amount Apple Pay/
// Google Pay show the shopper in their own approval sheet. amount: dollars,
// same convention as everywhere else on this site.
export async function createSquarePaymentRequest(amount, label = 'VEIL') {
  const payments = await getSquarePayments();
  return payments.paymentRequest({
    countryCode: 'US',
    currencyCode: 'USD',
    total: { amount: Number(amount).toFixed(2), label },
  });
}

// Apple Pay and Google Pay: Square renders its own branded button into the
// container (same attach() shape as the card element), and resolves the
// payment synchronously once the shopper approves in their device/browser's
// native sheet — no redirect, so this fits the same charge-in-one-request
// flow the card path uses. Returns null (rather than throwing) if this
// wallet can't be offered here — e.g. Apple Pay outside Safari, or before
// this domain has completed Apple's merchant domain verification — so
// calling pages can just hide the button instead of crashing.
export async function createApplePayButton(amount, containerId) {
  try {
    const payments = await getSquarePayments();
    const paymentRequest = await createSquarePaymentRequest(amount);
    const applePay = await payments.applePay(paymentRequest);
    await applePay.attach(`#${containerId}`);
    return applePay;
  } catch (err) {
    console.error('Apple Pay unavailable:', err);
    return null;
  }
}

export async function createGooglePayButton(amount, containerId) {
  try {
    const payments = await getSquarePayments();
    const paymentRequest = await createSquarePaymentRequest(amount);
    const googlePay = await payments.googlePay(paymentRequest);
    // buttonSizeMode: 'fill' — without it Google's own button renders at
    // its default (narrower) size instead of filling walletButtonContainer's
    // full width.
    await googlePay.attach(`#${containerId}`, { buttonSizeMode: 'fill', buttonColor: 'black', buttonType: 'buy' });
    return googlePay;
  } catch (err) {
    console.error('Google Pay unavailable:', err);
    return null;
  }
}

// Afterpay/Clearpay: same attach()-then-click-then-tokenize() shape as
// Apple/Google Pay above — Square presents the installment approval in a
// popup and resolves tokenize()'s promise once the shopper completes it
// there, not a full-page redirect away from checkout. Subject to
// Afterpay's own order-amount eligibility range (roughly $35–$2,000 in the
// US, unconfirmed against current Square docs) — an order outside that
// range is expected to fail here and simply not show the button, same as
// any other unavailable wallet.
export async function createAfterpayButton(amount, containerId) {
  try {
    const payments = await getSquarePayments();
    const paymentRequest = await createSquarePaymentRequest(amount);
    const afterpay = await payments.afterpayClearpay(paymentRequest);
    await afterpay.attach(`#${containerId}`);
    return afterpay;
  } catch (err) {
    console.error('Afterpay unavailable:', err);
    return null;
  }
}

// tokenize() on click — used for Apple Pay, Google Pay, and Afterpay,
// which all resolve the same way the card element's tokenize() does.
export async function tokenizeWallet(method) {
  let tokenResult;
  try {
    tokenResult = await method.tokenize();
  } catch (err) {
    console.error('Square wallet tokenize() threw:', err);
    throw err;
  }
  if (tokenResult.status === 'OK') return tokenResult.token;
  console.error('Square wallet tokenize returned non-OK status:', JSON.stringify(tokenResult));
  const detail = tokenResult.errors ? JSON.stringify(tokenResult.errors) : tokenResult.status;
  throw new Error(`Payment was not approved: ${detail}`);
}
