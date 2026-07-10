import React from 'react';
import { useRouter } from 'next/router';
import { PRODUCTS } from '../../lib/products';
import { T, S } from '../../lib/theme';

const LIVE_POLL_MS = 5000;
const STAGE_LABELS = {
  browsing: 'Browsing',
  cart_open: 'Cart open',
  checkout: 'At checkout',
  purchased: 'Just purchased',
};

export default function AdminDashboard() {
  const router = useRouter();
  const [dashboard, setDashboard] = React.useState(null);
  const [live, setLive] = React.useState({ count: 0, byStage: {} });
  const [reviews, setReviews] = React.useState([]);
  const [reviewsLoading, setReviewsLoading] = React.useState(true);
  const [importForm, setImportForm] = React.useState({ productId: PRODUCTS[0]?.id || '', rating: 5, text: '', author: '' });
  const [importMessage, setImportMessage] = React.useState('');

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
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <span style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 22, letterSpacing: '0.2em' }}>VEIL admin</span>
          <button onClick={handleLogout} style={S.btnOutline}>Sign out</button>
        </div>

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
