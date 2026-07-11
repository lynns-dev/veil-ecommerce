import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { PRODUCTS } from '../../lib/products';
import { parseCsv } from '../../lib/csv';
import WorldMap from '../../components/WorldMap';
import { T, S } from '../../lib/theme';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Flexible header matching — review export files from different platforms
// (Judge.me, Loox, Yotpo, Stamped, ...) all name these columns differently.
const FIELD_ALIASES = {
  product: ['product', 'product_id', 'product name', 'product_name', 'product_title', 'title', 'handle'],
  rating: ['rating', 'stars', 'score'],
  text: ['text', 'review', 'body', 'content', 'review_text', 'review_body', 'comment'],
  author: ['author', 'name', 'reviewer', 'reviewer_name', 'customer', 'customer_name'],
};

function pickField(row, key) {
  for (const alias of FIELD_ALIASES[key]) {
    if (row[alias] !== undefined && row[alias] !== '') return row[alias];
  }
  return '';
}

function matchProductId(value) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  const byId = PRODUCTS.find((p) => p.id.toLowerCase() === normalized);
  if (byId) return byId.id;
  const byName = PRODUCTS.find((p) => p.name.toLowerCase() === normalized);
  if (byName) return byName.id;
  const byPartial = PRODUCTS.find((p) => normalized.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(normalized));
  return byPartial ? byPartial.id : null;
}

const LIVE_POLL_MS = 5000;
const STAGE_LABELS = {
  browsing: 'Browsing',
  cart_open: 'Cart open',
  checkout: 'At checkout',
  purchased: 'Just purchased',
};
const EMPTY_ACTIVITY = { counts: { addtocart: 0, checkout_start: 0, purchase: 0, revenue: 0 }, buckets: [], recent: [] };
const ACTIVITY_LABELS = {
  addtocart: 'Added to cart',
  checkout_start: 'Started checkout',
  purchase: 'Purchased',
};

function timeAgo(ts) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

const countryNames = typeof Intl !== 'undefined' && Intl.DisplayNames
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

function countryFlag(code) {
  if (!code || code === 'XX' || code.length !== 2) return '🌐';
  const codePoints = [...code.toUpperCase()].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

function countryName(code) {
  if (!code || code === 'XX') return 'Unknown';
  try {
    return countryNames?.of(code) || code;
  } catch {
    return code;
  }
}

export default function AdminDashboard() {
  const router = useRouter();
  const [dashboard, setDashboard] = React.useState(null);
  const [live, setLive] = React.useState({ count: 0, byStage: {}, byCountry: {}, activity: EMPTY_ACTIVITY });
  const [reviews, setReviews] = React.useState([]);
  const [reviewsLoading, setReviewsLoading] = React.useState(true);
  const [importForm, setImportForm] = React.useState({ productId: PRODUCTS[0]?.id || '', rating: 5, text: '', author: '' });
  const [importMessage, setImportMessage] = React.useState('');
  const [csvStatus, setCsvStatus] = React.useState('idle'); // idle | processing
  const [csvSummary, setCsvSummary] = React.useState(null);
  const [discounts, setDiscounts] = React.useState([]);
  const [discountForm, setDiscountForm] = React.useState({ code: '', type: 'percent', value: 10 });
  const [discountFormMessage, setDiscountFormMessage] = React.useState('');
  const [notifStatus, setNotifStatus] = React.useState('unsupported'); // unsupported | denied | off | on | busy
  const [notifMessage, setNotifMessage] = React.useState('');
  const [hoveredCountry, setHoveredCountry] = React.useState(null);

  const mapCounts = React.useMemo(
    () => Object.fromEntries(Object.entries(live.byCountry).map(([code, data]) => [code.toLowerCase(), data.count])),
    [live.byCountry]
  );

  React.useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      if (existing) setNotifStatus('on');
      else if (Notification.permission === 'denied') setNotifStatus('denied');
      else setNotifStatus('off');
    }).catch(() => setNotifStatus('unsupported'));
  }, []);

  const handleEnableNotifications = async () => {
    setNotifMessage('');
    setNotifStatus('busy');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setNotifStatus(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
      });
      await fetch('/api/admin/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
      setNotifStatus('on');
      setNotifMessage('Notifications enabled on this device.');
    } catch (err) {
      setNotifStatus('off');
      setNotifMessage(err.message || 'Could not enable notifications.');
    }
  };

  const handleDisableNotifications = async () => {
    setNotifStatus('busy');
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/admin/push-unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setNotifStatus('off');
      setNotifMessage('Notifications turned off on this device.');
    } catch (err) {
      setNotifStatus('on');
      setNotifMessage(err.message || 'Could not disable notifications.');
    }
  };

  const loadDashboard = React.useCallback(() => {
    fetch('/api/admin/dashboard').then((r) => r.json()).then(setDashboard).catch(() => {});
  }, []);

  const loadReviews = React.useCallback(() => {
    setReviewsLoading(true);
    fetch('/api/admin/reviews')
      .then((r) => r.json())
      .then((data) => setReviews(data.reviews || []))
      .finally(() => setReviewsLoading(false));
  }, []);

  const loadDiscounts = React.useCallback(() => {
    fetch('/api/admin/discounts').then((r) => r.json()).then((data) => setDiscounts(data.discounts || [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    loadDashboard();
    loadReviews();
    loadDiscounts();
  }, [loadDashboard, loadReviews, loadDiscounts]);

  React.useEffect(() => {
    const poll = () => fetch('/api/admin/live').then((r) => r.json()).then(setLive).catch(() => {});
    poll();
    const interval = setInterval(poll, LIVE_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteReview = async (productId, reviewId) => {
    if (!confirm('Delete this review?')) return;
    await fetch('/api/admin/reviews', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, reviewId }),
    });
    loadReviews();
  };

  const handleApproveReview = async (productId, reviewId) => {
    await fetch('/api/admin/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, reviewId, action: 'approve' }),
    });
    loadReviews();
  };

  const pendingReviews = reviews.filter((r) => r.status !== 'approved');
  const approvedReviews = reviews.filter((r) => r.status === 'approved');

  const handleCsvFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCsvStatus('processing');
    setCsvSummary(null);

    const text = await file.text();
    const rows = parseCsv(text);

    let imported = 0;
    const skipped = [];

    // Sequential on purpose — addReview does a read-then-write against the
    // same KV key per product, so parallel rows for the same product would
    // race and clobber each other.
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const productId = matchProductId(pickField(row, 'product'));
      const rating = Number(pickField(row, 'rating'));
      const text = pickField(row, 'text');
      const author = pickField(row, 'author');

      if (!productId) {
        skipped.push({ row: i + 2, reason: `Couldn't match product "${pickField(row, 'product')}"` });
        continue;
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        skipped.push({ row: i + 2, reason: `Invalid rating "${pickField(row, 'rating')}"` });
        continue;
      }
      if (!text.trim()) {
        skipped.push({ row: i + 2, reason: 'Missing review text' });
        continue;
      }

      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, rating, text, author, source: 'imported' }),
        });
        if (!res.ok) {
          const data = await res.json();
          skipped.push({ row: i + 2, reason: data.error || 'Server rejected this row' });
        } else {
          imported++;
        }
      } catch {
        skipped.push({ row: i + 2, reason: 'Network error' });
      }
    }

    setCsvSummary({ imported, skipped });
    setCsvStatus('idle');
    loadReviews();
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    setImportMessage('');
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...importForm, source: 'imported' }),
    });
    const data = await res.json();
    if (!res.ok) {
      setImportMessage(data.error || 'Failed to add review.');
      return;
    }
    setImportForm({ productId: importForm.productId, rating: 5, text: '', author: '' });
    setImportMessage('Added.');
    loadReviews();
  };

  const handleAddDiscount = async (e) => {
    e.preventDefault();
    setDiscountFormMessage('');
    const res = await fetch('/api/admin/discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discountForm),
    });
    const data = await res.json();
    if (!res.ok) {
      setDiscountFormMessage(data.error || 'Failed to add code.');
      return;
    }
    setDiscounts(data.discounts);
    setDiscountForm({ code: '', type: 'percent', value: 10 });
    setDiscountFormMessage('Added.');
  };

  const handleRemoveDiscount = async (code) => {
    if (!confirm(`Remove code "${code}"?`)) return;
    const res = await fetch('/api/admin/discounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok) setDiscounts(data.discounts);
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: T.paper, padding: '32px 24px 80px' }}>
      <Head>
        <title>VEIL Admin</title>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content={T.ink} />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VEIL Admin" />
      </Head>

      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <span style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 22, letterSpacing: '0.2em' }}>VEIL admin</span>
          <button onClick={handleLogout} style={S.btnOutline}>Sign out</button>
        </div>

        {/* NOTIFICATIONS */}
        <Section title="Order notifications">
          {notifStatus === 'unsupported' && (
            <p style={{ color: T.soft, fontSize: 14 }}>Push notifications aren't supported in this browser. On iPhone, add this page to your Home Screen first (Share → Add to Home Screen), then open it from there — iOS only allows push notifications for installed home-screen apps.</p>
          )}
          {notifStatus === 'denied' && (
            <p style={{ color: T.soft, fontSize: 14 }}>Notifications are blocked for this site — enable them in your browser/device settings, then reload this page.</p>
          )}
          {(notifStatus === 'off' || notifStatus === 'busy') && (
            <button onClick={handleEnableNotifications} disabled={notifStatus === 'busy'} style={{ ...S.btnFill, opacity: notifStatus === 'busy' ? 0.6 : 1 }}>
              {notifStatus === 'busy' ? 'Working…' : 'Enable notifications on this device'}
            </button>
          )}
          {notifStatus === 'on' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 14 }}>Notifications are on for this device.</span>
              <button onClick={handleDisableNotifications} style={S.btnOutline}>Turn off</button>
            </div>
          )}
          {notifMessage && <p style={{ fontSize: 12, color: T.soft, marginTop: 12 }}>{notifMessage}</p>}
        </Section>

        {/* TOP STATS */}
        <div className="stat-grid" style={statGrid}>
          <StatCard label="Revenue today" value={dashboard ? `$${dashboard.revenueToday.toFixed(2)}` : '—'} />
          <StatCard label="Orders today" value={dashboard ? dashboard.ordersToday : '—'} />
          <StatCard label="Live visitors" value={live.count} highlight />
        </div>

        {/* LIVE FUNNEL */}
        <Section title="Live visitors by stage">
          {live.count === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No one on the site right now.</p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 24 }}>
                {Object.entries(STAGE_LABELS).map(([key, label]) => (
                  <div key={key} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: T.serif, fontSize: 32 }}>{live.byStage[key] || 0}</div>
                    <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft }}>{label}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        {/* LIVE LOCATIONS */}
        <Section title="Live visitors by location">
          {live.count === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No one on the site right now.</p>
          ) : (
            <>
              <div style={{ position: 'relative', marginBottom: 24 }}>
                <WorldMap counts={mapCounts} onHoverCountry={setHoveredCountry} />
                <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 12, color: T.soft, background: T.paper, padding: hoveredCountry ? '4px 8px' : 0 }}>
                  {hoveredCountry && (
                    <span>
                      {countryFlag(hoveredCountry.toUpperCase())} {countryName(hoveredCountry.toUpperCase())} — {live.byCountry[hoveredCountry.toUpperCase()]?.count ?? mapCounts[hoveredCountry]}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {Object.entries(live.byCountry)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([code, data]) => (
                  <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 18, width: 24, flexShrink: 0 }}>{countryFlag(code)}</span>
                      <span style={{ fontSize: 13, width: 140, flexShrink: 0 }}>{countryName(code)}</span>
                      <div style={{ flex: 1, height: 8, background: T.paper }}>
                        <div style={{ height: '100%', width: `${(data.count / live.count) * 100}%`, background: T.ink }} />
                      </div>
                      <span style={{ fontSize: 13, color: T.soft, width: 20, textAlign: 'right', flexShrink: 0 }}>{data.count}</span>
                    </div>
                    {data.cities.length > 0 && (
                      <p style={{ fontSize: 11, color: T.soft, margin: 0, paddingLeft: 36 }}>
                        {data.cities.map((c) => `${c.city} (${c.count})`).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>

        {/* LIVE ACTIVITY */}
        <Section title="Live activity (last 5 minutes)">
          <div style={{ display: 'flex', gap: 32, marginBottom: 24, flexWrap: 'wrap' }}>
            <FunnelStep label="Added to cart" value={live.activity.counts.addtocart} />
            <FunnelStep label="Checkouts started" value={live.activity.counts.checkout_start} />
            <FunnelStep label="Purchases" value={live.activity.counts.purchase} rate={live.activity.counts.revenue > 0 ? `$${live.activity.counts.revenue.toFixed(2)}` : null} />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90, marginBottom: 8 }}>
            {live.activity.buckets.map((bucket, i) => {
              const total = bucket.addtocart + bucket.checkout_start + bucket.purchase;
              const barHeight = Math.min(90, total * 14);
              return (
                <div key={i} style={{ flex: 1, height: 90, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  {total > 0 ? (
                    <div style={{ height: barHeight, display: 'flex', flexDirection: 'column-reverse' }}>
                      {bucket.addtocart > 0 && <div style={{ flex: bucket.addtocart, background: 'rgba(22,20,15,0.25)' }} />}
                      {bucket.checkout_start > 0 && <div style={{ flex: bucket.checkout_start, background: 'rgba(22,20,15,0.55)' }} />}
                      {bucket.purchase > 0 && <div style={{ flex: bucket.purchase, background: T.ink }} />}
                    </div>
                  ) : (
                    <div style={{ height: 2, background: T.line }} />
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.soft, marginBottom: 24 }}>
            <span>5m ago</span>
            <span>now</span>
          </div>
          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: T.soft, marginBottom: 24 }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(22,20,15,0.25)', marginRight: 6 }} />Added to cart</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(22,20,15,0.55)', marginRight: 6 }} />Checkout started</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: T.ink, marginRight: 6 }} />Purchased</span>
          </div>

          {live.activity.recent.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No activity in the last 5 minutes.</p>
          ) : (
            <div>
              {live.activity.recent.map((ev, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
                  <span>
                    {ACTIVITY_LABELS[ev.type] || ev.type}
                    {ev.productName && ` — ${ev.productName}`}
                    {ev.type === 'purchase' && ev.amount != null && ` — $${Number(ev.amount).toFixed(2)}`}
                  </span>
                  <span style={{ color: T.soft }}>{timeAgo(ev.ts)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* PAYMENT METHODS */}
        <Section title="Payment methods today">
          {!dashboard || dashboard.paymentMethods.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No orders yet today.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dashboard.paymentMethods.map(({ method, count, revenue }) => {
                const maxCount = Math.max(...dashboard.paymentMethods.map((m) => m.count));
                return (
                  <div key={method} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, width: 110, flexShrink: 0 }}>{method}</span>
                    <div style={{ flex: 1, height: 8, background: T.paper }}>
                      <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: T.ink }} />
                    </div>
                    <span style={{ fontSize: 13, color: T.soft, width: 90, textAlign: 'right', flexShrink: 0 }}>
                      {count} order{count === 1 ? '' : 's'} · ${revenue.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* FUNNEL / CONVERSION */}
        <Section title="Today's funnel">
          {dashboard && (
            <div className="funnel-grid" style={funnelGrid}>
              <FunnelStep label="Page views" value={dashboard.funnel.pageviews} />
              <FunnelStep label="Added to cart" value={dashboard.funnel.addToCart} rate={`${dashboard.funnel.addToCartRate}% of views`} />
              <FunnelStep label="Started checkout" value={dashboard.funnel.checkoutStarts} rate={`${dashboard.funnel.checkoutRate}% of adds`} />
              <FunnelStep label="Purchased" value={dashboard.funnel.purchases} rate={`${dashboard.funnel.conversionRate}% of views`} />
            </div>
          )}
        </Section>

        {/* PENDING REVIEWS */}
        <Section title={`Pending approval (${pendingReviews.length})`}>
          {reviewsLoading ? (
            <p style={{ color: T.soft, fontSize: 14 }}>Loading…</p>
          ) : pendingReviews.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>Nothing waiting on approval.</p>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {pendingReviews.map((r) => (
                <div key={`${r.productId}-${r.id}`} style={reviewRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: T.soft, marginBottom: 4 }}>
                      {r.productName} · {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {r.author} · {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 14 }}>{r.text}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => handleApproveReview(r.productId, r.id)} style={S.btnOutline}>Approve</button>
                    <button onClick={() => handleDeleteReview(r.productId, r.id)} style={deleteBtn}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* PUBLISHED REVIEWS */}
        <Section title={`Published reviews (${approvedReviews.length})`}>
          {reviewsLoading ? (
            <p style={{ color: T.soft, fontSize: 14 }}>Loading…</p>
          ) : approvedReviews.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No published reviews yet.</p>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {approvedReviews.map((r) => (
                <div key={`${r.productId}-${r.id}`} style={reviewRow}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: T.soft, marginBottom: 4 }}>
                      {r.productName} · {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)} · {r.author} · {new Date(r.createdAt).toLocaleDateString()}
                      {r.source === 'imported' && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>(imported)</span>}
                    </div>
                    <div style={{ fontSize: 14 }}>{r.text}</div>
                  </div>
                  <button onClick={() => handleDeleteReview(r.productId, r.id)} style={deleteBtn}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* IMPORT REVIEW */}
        <Section title="Add a review manually">
          <p style={{ fontSize: 12, color: T.soft, marginBottom: 16 }}>Use this to bring over reviews from your other site, one at a time.</p>
          <form onSubmit={handleImportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
            <select value={importForm.productId} onChange={(e) => setImportForm({ ...importForm, productId: e.target.value })} style={formInput}>
              {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 12 }}>
              <select value={importForm.rating} onChange={(e) => setImportForm({ ...importForm, rating: Number(e.target.value) })} style={{ ...formInput, width: 100 }}>
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} star{n === 1 ? '' : 's'}</option>)}
              </select>
              <input placeholder="Author name" value={importForm.author} onChange={(e) => setImportForm({ ...importForm, author: e.target.value })} style={{ ...formInput, flex: 1 }} />
            </div>
            <textarea placeholder="Review text" value={importForm.text} onChange={(e) => setImportForm({ ...importForm, text: e.target.value })} style={{ ...formInput, minHeight: 80 }} required />
            {importMessage && <p style={{ fontSize: 12, color: T.ink }}>{importMessage}</p>}
            <button type="submit" style={{ ...S.btnFill, alignSelf: 'flex-start' }}>Add review</button>
          </form>
        </Section>

        {/* CSV IMPORT */}
        <Section title="Import reviews from a CSV">
          <p style={{ fontSize: 12, color: T.soft, marginBottom: 16 }}>
            Columns (any order, header names are flexible): <strong>product</strong> (name or id), <strong>rating</strong> (1–5),{' '}
            <strong>text</strong>, <strong>author</strong>. Imported reviews publish immediately.
          </p>
          <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} disabled={csvStatus === 'processing'} />
          {csvStatus === 'processing' && <p style={{ fontSize: 13, color: T.soft, marginTop: 12 }}>Importing…</p>}
          {csvSummary && (
            <div style={{ marginTop: 16, fontSize: 13 }}>
              <p style={{ color: T.ink, marginBottom: 8 }}>
                Imported {csvSummary.imported}{csvSummary.skipped.length > 0 ? `, skipped ${csvSummary.skipped.length}` : ''}.
              </p>
              {csvSummary.skipped.length > 0 && (
                <div style={{ maxHeight: 200, overflowY: 'auto', color: '#a13d2b' }}>
                  {csvSummary.skipped.map((s, i) => (
                    <div key={i}>Row {s.row}: {s.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* DISCOUNT CODES */}
        <Section title={`Discount codes (${discounts.length})`}>
          {discounts.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14, marginBottom: 20 }}>No discount codes yet.</p>
          ) : (
            <div style={{ marginBottom: 20 }}>
              {discounts.map((d) => (
                <div key={d.code} style={reviewRow}>
                  <div style={{ flex: 1, fontSize: 14 }}>
                    <strong>{d.code}</strong> — {d.type === 'percent' ? `${d.value}% off` : `$${d.value} off`}
                  </div>
                  <button onClick={() => handleRemoveDiscount(d.code)} style={deleteBtn}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddDiscount} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={formLabel}>Code</label>
              <input
                placeholder="SUMMER20"
                value={discountForm.code}
                onChange={(e) => setDiscountForm({ ...discountForm, code: e.target.value })}
                style={{ ...formInput, width: 160 }}
                required
              />
            </div>
            <div>
              <label style={formLabel}>Type</label>
              <select value={discountForm.type} onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value })} style={{ ...formInput, width: 120 }}>
                <option value="percent">% off</option>
                <option value="fixed">$ off</option>
              </select>
            </div>
            <div>
              <label style={formLabel}>Value</label>
              <input
                type="number"
                min="1"
                value={discountForm.value}
                onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })}
                style={{ ...formInput, width: 100 }}
                required
              />
            </div>
            <button type="submit" style={S.btnFill}>Add code</button>
          </form>
          {discountFormMessage && <p style={{ fontSize: 12, color: T.ink, marginTop: 12 }}>{discountFormMessage}</p>}
        </Section>
      </div>

      <style jsx>{`
        .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .funnel-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 640px) {
          .stat-grid { grid-template-columns: 1fr; }
          .funnel-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div style={{ ...statCard, ...(highlight ? { borderColor: T.ink } : {}) }}>
      <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 34 }}>{value}</div>
      <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function FunnelStep({ label, value, rate }) {
  return (
    <div>
      <div style={{ fontFamily: T.serif, fontSize: 28 }}>{value ?? 0}</div>
      <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft }}>{label}</div>
      {rate && <div style={{ fontSize: 12, color: T.ink, marginTop: 2 }}>{rate}</div>}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: T.white, border: `1px solid ${T.line}`, padding: 24, marginBottom: 24 }}>
      <p style={{ ...S.label, marginBottom: 18 }}>{title}</p>
      {children}
    </div>
  );
}

const statGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 };
const statCard = { background: T.white, border: `1px solid ${T.line}`, padding: '24px 20px', textAlign: 'center' };
const funnelGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 };
const reviewRow = { display: 'flex', gap: 16, alignItems: 'flex-start', padding: '14px 0', borderBottom: `1px solid ${T.line}` };
const deleteBtn = {
  fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', border: `1px solid ${T.line}`,
  background: 'none', padding: '8px 12px', cursor: 'pointer', fontFamily: T.sans, flexShrink: 0, color: '#a13d2b',
};
const formInput = {
  width: '100%', height: 44, padding: '0 12px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box',
};
const formLabel = {
  display: 'block', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft, marginBottom: 6,
};
