// Square Web Payments SDK — client-side card tokenization.
//
// Unlike Stripe's @stripe/stripe-js (an npm package), Square's Web Payments
// SDK is a plain script tag that attaches a `Square` global — loadSquare()
// injects it once and caches the promise, same shape as loadStripe().
// NEXT_PUBLIC_SQUARE_ENVIRONMENT picks which CDN script/API host to use;
// it must match the account the access token and location ID belong to,
// same requirement as Stripe's publishable/secret key pairing.
//
// Card.tokenize() flow (payments.card() -> attach -> tokenize) confirmed
// against Square's own "Take a Card Payment" docs. The server-side
// CreatePayment call this token gets sent to (lib/squareServer.js) was
// NOT verified against primary docs this session — treat both as
// unverified until a real charge has gone through end-to-end.

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

// Resolves to an initialized Square Card instance, already attached to the
// given DOM element id — ready for tokenize() once the shopper submits.
export async function createSquareCard(containerId) {
  const appId = process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID;
  const locationId = process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID;
  const environment = process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT || 'production';
  if (!appId || !locationId) throw new Error('NEXT_PUBLIC_SQUARE_APPLICATION_ID / NEXT_PUBLIC_SQUARE_LOCATION_ID are not set.');

  const Square = await loadSquareScript(environment);
  const payments = Square.payments(appId, locationId);
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
