import React from 'react';
import { generateEventId } from '../lib/fbPixel';
import { getStoredAttribution } from '../lib/attribution';

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
    // QuickBooks, so only the PayPal-account button should render here.
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&disable-funding=card`;
    script.onload = () => resolve(window.paypal);
    script.onerror = () => reject(new Error('Failed to load the PayPal SDK.'));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

// amount/items/eventId/url change on every render as the cart/discount
// change, but paypal.Buttons().render() only runs once — the createOrder/
// onApprove callbacks it's given are closures from that first render. A ref
// keeps them reading the current values without tearing down and
// re-rendering the button on every keystroke.
export default function PayPalButton({ amount, items, url, disabled, onSuccess, onError }) {
  const containerRef = React.useRef(null);
  const stateRef = React.useRef({ amount, items, url, eventId: null });
  stateRef.current.amount = amount;
  stateRef.current.items = items;
  stateRef.current.url = url;

  React.useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId || !containerRef.current) return;

    let cancelled = false;

    loadPaypalSdk(clientId)
      .then((paypal) => {
        if (cancelled || !containerRef.current) return;

        paypal
          .Buttons({
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
                  attribution: getStoredAttribution(),
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
          })
          .render(containerRef.current);
      })
      .catch((err) => onError?.(err.message));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <div ref={containerRef} />
    </div>
  );
}
