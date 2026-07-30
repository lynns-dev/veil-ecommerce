// Browser half of the embedded Shop Pay Wallet integration — loads
// Shopify's JS SDK and opens the payment modal on top of this page (the
// shopper never navigates to checkout.shopify.com), same one-click-wallet
// shape as Apple/Google Pay elsewhere in this codebase (lib/squareClient.js).
//
// VERIFICATION STATUS — same caveat as lib/shopPayServer.js's top comment:
// shopify.dev was unreachable from this environment while building this, so
// the SDK's exact global/method names below (window.ShopPay.paymentRequest.
// createButton(...).render(...), the 'paymentcomplete' event name) come from
// a Shopify Partner's published Salesforce Commerce Cloud connector guide
// rather than the primary JS SDK reference. Wrapped defensively for exactly
// this reason — same pattern as createApplePayButton/createAfterpayButton
// below in squareClient.js: any failure (SDK didn't load, an unrecognized
// global, an API shape mismatch) resolves to null/false rather than
// throwing, so a wrong guess here just means the button doesn't render
// instead of breaking checkout. Once real credentials exist, mount a test
// button and confirm in the browser console that window.ShopPay looks like
// what's assumed here — that's the one live check this integration
// actually needs before launch.

const SDK_URL = 'https://cdn.shopify.com/shopifycloud/shop-js/shop-pay-payment-request.js';

let loadPromise = null;

function loadShopPaySdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Shop Pay SDK can only load in the browser.'));
  if (window.ShopPay) return Promise.resolve(window.ShopPay);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => (window.ShopPay ? resolve(window.ShopPay) : reject(new Error('Shop Pay SDK loaded but window.ShopPay is missing.')));
    script.onerror = () => reject(new Error('Failed to load the Shop Pay Wallet SDK.'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// Resolves true once the SDK is loaded and looks like the shape this file
// assumes — callers use this to decide whether to render a Shop Pay button
// at all, same "quietly unavailable rather than broken" contract every
// other wallet integration here follows.
export async function isShopPayAvailable() {
  try {
    const ShopPay = await loadShopPaySdk();
    return Boolean(ShopPay?.paymentRequest?.createButton);
  } catch (err) {
    console.error('Shop Pay unavailable:', err);
    return false;
  }
}

// Mounts the SDK's own button into the given container. Returns a teardown
// function (or null if mounting failed) so callers can unmount on unmount
// the same way the rest of this codebase manages wallet lifecycles.
//
// onSessionRequest: called with no args when the shopper opens the sheet —
// must resolve to the { token, checkoutUrl, sourceIdentifier } session
// object from POST /api/shop-pay/session (a fresh session per open, not
// cached, since cart contents or a promo code may have changed since the
// button first rendered).
// onComplete / onError / onClose: mirror the outcomes this codebase's other
// wallet buttons already report through (handleApplePay in
// components/CartDrawer.jsx) — success, a real failure, or the shopper
// dismissing the sheet themselves.
export async function mountShopPayButton(containerId, { onSessionRequest, onComplete, onError, onClose }) {
  try {
    const ShopPay = await loadShopPaySdk();
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Shop Pay: container #${containerId} not found.`);

    const button = ShopPay.paymentRequest.createButton({ buyWith: false });

    button.on?.('sessionrequested', async (event) => {
      try {
        const session = await onSessionRequest();
        event.complete?.(session);
      } catch (err) {
        console.error('Shop Pay session request failed:', err);
        event.error?.(err.message || 'Could not start Shop Pay.');
      }
    });

    button.on?.('paymentcomplete', (event) => onComplete?.(event));
    button.on?.('paymentsheetclosed', () => onClose?.());
    button.on?.('error', (event) => onError?.(event));

    button.render(`#${containerId}`);
    return () => {
      try { button.unmount?.(); } catch { /* no-op — best-effort teardown */ }
    };
  } catch (err) {
    console.error('Shop Pay button mount failed:', err);
    onError?.(err);
    return null;
  }
}
