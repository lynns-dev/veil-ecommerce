import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { PRODUCTS } from '../../lib/products';
import { T, S } from '../../lib/theme';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
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
  const [notifStatus, setNotifStatus] = React.useState('unsupported'); // unsupported | denied | off | on | busy
  const [notifMessage, setNotifMessage] = React.useState('');

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

  React.useEffect(() => {
    loadDashboard();
    loadReviews();
  }, [loadDashboard, loadReviews]);

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
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {Object.entries(STAGE_LABELS).map(([key, label]) => (
                <div key={key} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: T.serif, fontSize: 32 }}>{live.byStage[key] || 0}</div>
                  <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* LIVE LOCATIONS */}
        <Section title="Live visitors by location">
          {live.count === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No one on the site right now.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(live.byCountry)
                .sort((a, b) => b[1] - a[1])
                .map(([code, count]) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18, width: 24, flexShrink: 0 }}>{countryFlag(code)}</span>
                    <span style={{ fontSize: 13, width: 140, flexShrink: 0 }}>{countryName(code)}</span>
                    <div style={{ flex: 1, height: 8, background: T.paper }}>
                      <div style={{ height: '100%', width: `${(count / live.count) * 100}%`, background: T.ink }} />
                    </div>
                    <span style={{ fontSize: 13, color: T.soft, width: 20, textAlign: 'right', flexShrink: 0 }}>{count}</span>
                  </div>
                ))}
            </div>
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

        {/* REVIEW MODERATION */}
        <Section title={`Reviews (${reviews.length})`}>
          {reviewsLoading ? (
            <p style={{ color: T.soft, fontSize: 14 }}>Loading…</p>
          ) : reviews.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No reviews yet.</p>
          ) : (
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {reviews.map((r) => (
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
