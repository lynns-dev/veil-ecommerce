import React from 'react';
import { generateEventId } from '../lib/fbPixel';

let sdkPromise = null;

// Loads the PayPal JS SDK once and reuses it across mounts — checkout only
// ever needs one instance of window.paypal.
function loadPaypalSdk(clientId) {
  if (window.paypal) return Promise.resolve(window.paypal);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // disable-funding=card suppresses PayPal's own separate "Debit or Credit
    // Card" button — the site already has its own card checkout via
    // QuickBooks, so only wallet buttons should render here. enable-funding
    // opts into Venmo/Apple Pay/Google Pay, which the SDK doesn't render by
    // default even on merchant accounts that support them.
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&disable-funding=card&enable-funding=venmo,applepay,googlepay`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error('Failed to load the PayPal SDK.'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

const FUNDING_LABELS = {
  paypal: 'PayPal',
  venmo: 'Venmo',
  applepay: 'Apple Pay',
  googlepay: 'Google Pay',
};

// amount/items/eventId/url change on every render as the cart/discount
// change, but paypal.Buttons().render() only runs once — the createOrder/
// onApprove callbacks it's given are closures from that first render. A ref
// keeps them reading the current values without tearing down and
// re-rendering the button on every keystroke.
//
// fundingSource picks which wallet button this instance renders — 'paypal'
// (default), 'venmo', 'applepay', or 'googlepay'. Apple Pay/Google Pay only
// render at all once eligible (Safari + Apple Pay set up, or a Google Pay
// account, respectively, AND the merchant account has that wallet enabled
// in the PayPal dashboard) — isEligible() gates this per instance so an
// unsupported wallet just doesn't render anything, no broken button.
export default function PayPalButton({ amount, items, url, disabled, onSuccess, onError, fundingSource = 'paypal' }) {
  const containerRef = React.useRef(null);
  const stateRef = React.useRef({ amount, items, url, eventId: null });
  stateRef.current.amount = amount;
  stateRef.current.items = items;
  stateRef.current.url = url;
  const [eligible, setEligible] = React.useState(true);

  React.useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId || !containerRef.current) return;

    let cancelled = false;

    loadPaypalSdk(clientId)
      .then((paypal) => {
        if (cancelled || !containerRef.current) return;

        const resolvedFundingSource = fundingSource === 'paypal' ? undefined : paypal.FUNDING[fundingSource.toUpperCase()];

        const buttons = paypal.Buttons({
          fundingSource: resolvedFundingSource,
          // No color/shape/label overrides — renders PayPal's own default
          // branded button rather than a custom-styled variant.
          style: { layout: 'vertical', height: 45 },
          createOrder: async () => {
            stateRef.current.eventId = generateEventId();
            const res = await fetch('/api/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: stateRef.current.amount }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not start PayPal checkout.');
            return data.id;
          },
          onApprove: async (data) => {
            const res = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: data.orderID,
                items: stateRef.current.items,
                eventId: stateRef.current.eventId,
                url: stateRef.current.url,
                paymentMethod: FUNDING_LABELS[fundingSource] || 'PayPal',
              }),
            });
            const result = await res.json();
            if (!res.ok) {
              onError?.(result.error || 'Payment could not be completed.');
              return;
            }
            onSuccess?.({ ...result, eventId: stateRef.current.eventId });
          },
          onError: (err) => {
            console.error('PayPal button error:', err);
            onError?.('PayPal checkout failed. Please try again.');
          },
        });

        if (!buttons.isEligible()) {
          setEligible(false);
          return;
        }

        buttons.render(containerRef.current);
      })
      .catch((err) => {
        // The SDK failing to *load* (blocked by an ad/privacy blocker, a
        // network hiccup, a bad client ID) happens before the shopper has
        // touched anything — it shouldn't surface as a page-level error
        // next to the card form. Just hide this button; card checkout still
        // works. A failure *during* an actual payment attempt is handled by
        // the onError callback above and does get reported.
        console.error('PayPal SDK load failed:', err);
        if (!cancelled) setEligible(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!eligible) return null;

  return (
    <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div ref={containerRef} />
    </div>
  );
}
