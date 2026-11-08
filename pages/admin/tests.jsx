// Admin → Tests: results of the store's split tests (lib/experiments.js).
// Per variant: visitors who saw it, how many added to cart, reached
// checkout and bought, and revenue per visitor. "Confidence" is a two-sided
// test on the purchase rate (add-to-cart rate while purchases are few).
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

function confidence(a, b, key) {
  const n1 = a.visitors || 0, n2 = b.visitors || 0;
  const x1 = a[key] || 0, x2 = b[key] || 0;
  if (n1 < 30 || n2 < 30) return null;
  const p = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(p * (1 - p) * (1 / n1 + 1 / n2));
  if (!se) return null;
  const z = Math.abs(x1 / n1 - x2 / n2) / se;
  // Normal CDF approximation.
  const t = 1 / (1 + 0.2316419 * z);
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const tail = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return Math.round((1 - 2 * tail) * 100);
}

export default function Tests() {
  const [data, setData] = React.useState(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    fetch('/api/admin/experiments')
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d.tests)))
      .catch(() => setError('Could not load test results.'));
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 960, margin: '0 auto', padding: '28px 16px', color: '#1f1f1f' }}>
      <Head><title>Split tests · Veil Admin</title></Head>
      <Link href="/admin" style={{ fontSize: 13, color: '#5f6368' }}>← Admin</Link>
      <h1 style={{ fontSize: 26, margin: '8px 0 4px' }}>Split tests</h1>
      <p style={{ fontSize: 13, color: '#5f6368', margin: '0 0 20px' }}>
        Running tests assign visitors 50/50. Drafts are inactive and available only through explicit preview URLs. Plan sample size and duration before evaluating results; confidence alone does not establish a winner.
      </p>
      {error && <p style={{ color: '#d93025' }}>{error}</p>}
      {!data && !error && <p>Loading…</p>}
      {data && data.map((t) => {
        const [a, b] = t.variants;
        const key = t.id === 'shop_pay_checkout_v1' ? 'purchased' : t.primaryMetric === 'checkout_view' ? 'checkout_view' : (a.purchased || 0) + (b?.purchased || 0) >= 20 ? 'purchased' : 'added';
        const conf = b ? confidence(a, b, key) : null;
        const leader = b && a.visitors && b.visitors ? ((b[key] || 0) / b.visitors > (a[key] || 0) / a.visitors ? b.variant : a.variant) : null;
        return (
          <section key={t.id} style={{ border: '1px solid #e1e3e1', borderRadius: 12, padding: 16, marginBottom: 16, overflowX: 'auto' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 16, margin: 0 }}>{t.name}</h2>
              <span style={{ fontSize: 12, color: '#5f6368' }}>
                {t.status === 'draft' ? 'Draft · inactive' : t.winner ? `Ended: "${t.winner}" for everyone` : `Running since ${t.started}`}
              </span>
            </div>
            {t.hypothesis && <p style={{ fontSize: 13, color: '#5f6368' }}>{t.hypothesis}</p>}
            {t.id === 'shop_pay_checkout_v1' && <p style={{ fontSize: 12 }}>
              Mobile: {t.variants.map(v => `${v.variant} ${v.purchased_mobile || 0}/${v.visitors_mobile || 0}`).join(' · ')}
              {' | '}Desktop: {t.variants.map(v => `${v.variant} ${v.purchased_desktop || 0}/${v.visitors_desktop || 0}`).join(' · ')}
            </p>}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 10, minWidth: 560 }}>
              <thead>
                <tr style={{ textAlign: 'right', color: '#5f6368' }}>
                  {['Version', 'Visitors', 'Added to cart', 'Reached checkout', 'Bought', 'Buy rate', 'Revenue', 'Per visitor'].map((h, i) => (
                    <th key={h} style={{ padding: '6px 8px', textAlign: i ? 'right' : 'left', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.variants.map((v) => (
                  <tr key={v.variant} style={{ borderTop: '1px solid #e1e3e1', textAlign: 'right' }}>
                    <td style={{ padding: '6px 8px', textAlign: 'left' }}>{v.variant}</td>
                    <td style={{ padding: '6px 8px' }}>{v.visitors || 0}</td>
                    <td style={{ padding: '6px 8px' }}>{v.added || 0} ({pct(v.added || 0, v.visitors)})</td>
                    <td style={{ padding: '6px 8px' }}>{v.checkout_view || 0} ({pct(v.checkout_view || 0, v.visitors)})</td>
                    <td style={{ padding: '6px 8px' }}>{v.purchased || 0}</td>
                    <td style={{ padding: '6px 8px' }}>{pct(v.purchased || 0, v.visitors)}</td>
                    <td style={{ padding: '6px 8px' }}>{money(v.revenue)}</td>
                    <td style={{ padding: '6px 8px' }}>{v.visitors ? money((v.revenue || 0) / v.visitors) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12, color: '#5f6368', margin: '8px 0 0' }}>
              {t.status === 'draft' ? 'Inactive. Query-string preview only; no visitors assigned and no results recorded.' : conf == null
                ? 'Not enough visitors yet to call it.'
                : `Leading: ${leader} · ${conf}% confidence on ${key === 'checkout_view' ? 'checkout-reach rate' : key === 'purchased' ? 'buy rate' : 'add-to-cart rate'} · directional estimate; review the planned sample size before deciding`}
            </p>
          </section>
        );
      })}
    </div>
  );
}
