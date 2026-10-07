import React from 'react';

// Afterpay button for the checkout pages (lib/afterpay.js has the flow).
// Renders nothing unless Afterpay is configured and the order total is in
// the range Afterpay finances. getOrder() runs at click time and returns
// the order, or { error } if the shopper still has something to fill in.

let configPromise = null;
function loadConfig() {
  if (!configPromise) {
    configPromise = fetch('/api/afterpay/config')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .catch(() => ({ enabled: false }));
  }
  return configPromise;
}

export default function AfterpayButton({ total, getOrder, onError, onReady }) {
  const [config, setConfig] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    loadConfig().then((c) => { if (!cancelled) setConfig(c); });
    return () => { cancelled = true; };
  }, []);

  const amount = Number(total) || 0;
  const available = Boolean(config?.enabled && amount >= config.min && amount <= config.max);
  React.useEffect(() => { onReady?.(available); }, [available, onReady]);
  if (!available) return null;

  const click = async () => {
    const order = getOrder();
    if (order?.error) { onError(order.error); return; }
    onError('');
    setBusy(true);
    try {
      const res = await fetch('/api/afterpay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Afterpay is unavailable right now.');
      window.location.assign(data.redirectCheckoutUrl);
    } catch (err) {
      onError(err.message || 'Afterpay is unavailable right now.');
      setBusy(false);
    }
  };

  const installment = (Math.ceil((amount / 4) * 100) / 100).toFixed(2);
  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      aria-label={`Pay with Afterpay — 4 interest-free payments of $${installment}`}
      style={{
        width: '100%', minHeight: 50, marginTop: 10, border: 'none', borderRadius: 6, cursor: busy ? 'default' : 'pointer',
        background: '#B2FCE4', color: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '8px 12px', opacity: busy ? 0.6 : 1, fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>{busy ? 'Opening Afterpay…' : 'Pay with afterpay'}</span>
      <span style={{ fontSize: 12, marginTop: 2 }}>4 interest-free payments of ${installment}</span>
    </button>
  );
}
