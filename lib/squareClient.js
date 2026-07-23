// Square Web Payments SDK — client-side tokenization for Card, Apple Pay,
// Google Pay, and Cash App Pay.
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
// and Cash App Pay below were NOT verified against primary docs this
// session — built from general knowledge of Square's Web Payments SDK.
// Each wallet is wrapped so a failure to initialize (unsupported browser/
// device, that wallet not enabled on the Square account, etc.) never
// breaks the rest of checkout — the calling page just doesn't show that
// button. The server-side CreatePayment call every token gets sent to
// (lib/squareServer.js) is also unverified — treat all of this as
// unverified until a real charge of each type has gone through end-to-end.

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
  const tokenResult = await card.tokenize(details);
  if (tokenResult.status === 'OK') {
    return tokenResult.token;
  }
  const detail = tokenResult.errors ? JSON.stringify(tokenResult.errors) : tokenResult.status;
  throw new Error(`Card verification failed: ${detail}`);
}

// Shared by every wallet method below — describes the amount Apple Pay/
// Google Pay/Cash App Pay show the shopper in their own approval sheet.
// amount: dollars, same convention as everywhere else on this site.
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
    // buttonSizeMode: 'fill' matches Cash App Pay's width: 'full' below —
    // without it Google's own button renders at its default (narrower)
    // size instead of filling squareCardContainer's full width.
    await googlePay.attach(`#${containerId}`, { buttonSizeMode: 'fill', buttonColor: 'black', buttonType: 'buy' });
    return googlePay;
  } catch (err) {
    console.error('Google Pay unavailable:', err);
    return null;
  }
}

// tokenize() on click — used for both Apple Pay and Google Pay, which
// resolve the same way the card element's tokenize() does.
export async function tokenizeWallet(method) {
  const tokenResult = await method.tokenize();
  if (tokenResult.status === 'OK') return tokenResult.token;
  const detail = tokenResult.errors ? JSON.stringify(tokenResult.errors) : tokenResult.status;
  throw new Error(`Payment was not approved: ${detail}`);
}

// Cash App Pay's attached button handles the whole interaction itself (an
// in-app approval prompt, or a QR code to scan on desktop) and reports back
// through an 'ontokenization' event rather than a click-then-await like
// Apple/Google Pay — there's no user-initiated click on our side to hang an
// await off of. onToken/onError are called once the shopper approves or the
// attempt fails/is cancelled. redirectURL/referenceId per Square's docs;
// referenceId should be unique per checkout attempt (not reused after a
// failed attempt) since Square uses it to match the eventual token back to
// this order.
export async function createCashAppPayButton(amount, containerId, { redirectURL, referenceId, onToken, onError }) {
  try {
    const payments = await getSquarePayments();
    const paymentRequest = await createSquarePaymentRequest(amount);
    const cashAppPay = await payments.cashAppPay(paymentRequest, { redirectURL, referenceId });
    await cashAppPay.attach(`#${containerId}`, { shape: 'semiround', width: 'full' });
    cashAppPay.addEventListener('ontokenization', (event) => {
      const { tokenResult, error } = event.detail || {};
      if (error) return onError?.(error);
      if (tokenResult?.status === 'OK') return onToken?.(tokenResult.token);
      onError?.(new Error(tokenResult?.status || 'Payment was not approved.'));
    });
    return cashAppPay;
  } catch (err) {
    console.error('Cash App Pay unavailable:', err);
    onError?.(err);
    return null;
  }
}
