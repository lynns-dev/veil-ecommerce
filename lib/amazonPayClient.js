// Browser side of Amazon Pay (see lib/amazonPay.js for the flow). Renders
// Amazon's own button into a container and, on click, asks
// /api/amazon-pay/session for the signed payload before handing off to
// Amazon. Resolves to false when Amazon Pay isn't configured, so the
// caller can keep the container hidden.

const SCRIPT_SRC = 'https://static-na.payments-amazon.com/checkout.js';
let scriptPromise = null;

function loadScript() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.amazon?.Pay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error('Amazon Pay failed to load')); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

// getOrder() runs at click time and returns the order to charge, or
// { error } if the shopper still has something to fill in.
export async function renderAmazonPayButton(containerId, { getOrder, onError }) {
  const cfgRes = await fetch('/api/amazon-pay/config').catch(() => null);
  const cfg = cfgRes && cfgRes.ok ? await cfgRes.json() : null;
  if (!cfg?.enabled) return false;
  await loadScript();
  if (!document.getElementById(containerId)) return false;

  const button = window.amazon.Pay.renderButton(`#${containerId}`, {
    merchantId: cfg.merchantId,
    publicKeyId: cfg.publicKeyId,
    ledgerCurrency: 'USD',
    checkoutLanguage: 'en_US',
    productType: 'PayOnly',
    placement: 'Checkout',
    buttonColor: 'Gold',
  });

  button.onClick(async () => {
    try {
      const order = getOrder();
      if (order?.error) { onError(order.error); return; }
      const res = await fetch('/api/amazon-pay/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Amazon Pay is unavailable right now.');
      button.initCheckout({
        createCheckoutSessionConfig: { payloadJSON: data.payloadJSON, signature: data.signature, algorithm: data.algorithm },
      });
    } catch (err) {
      onError(err.message || 'Amazon Pay is unavailable right now.');
    }
  });
  return true;
}
