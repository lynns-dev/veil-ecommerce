import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { PRODUCTS } from '../../lib/products';
import { parseCsv } from '../../lib/csv';
import { describeAdPlacement } from '../../lib/attribution';
import { T, S } from '../../lib/adminTheme';
import { orderLabel } from '../../lib/orderNumbers';
import AdminNavIcon from '../../components/AdminNavIcon';
import PathsTree from '../../components/PathsTree';

// Flexible header matching — review export files from different platforms
// (Judge.me, Loox, Yotpo, Stamped, ...) all name these columns differently.
// No "product" entry: which product a CSV belongs to is now chosen once in
// the admin UI before upload, rather than matched per-row from a column.
const FIELD_ALIASES = {
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

const LIVE_POLL_MS = 5000;
const DASHBOARD_POLL_MS = 15000;
const FUNNEL_RANGE_LABELS = {
  today: "Today's funnel",
  yesterday: "Yesterday's funnel",
  '7d': 'Funnel — last 7 days',
  '30d': 'Funnel — last 30 days',
};
// checkout_* are the live 2-step checkout's individual steps (see
// lib/checkoutStage.js). The plain 'checkout' stage still exists (sent by
// checkout-square.jsx, the single-page backup with no steps of its own,
// and as checkout.jsx/checkout-qb.jsx's brief pre-hydration fallback) but
// is deliberately left out of this list — it's not currently reachable by
// real traffic, and including it would add a near-always-empty column to
// the summary row/bar below. A visitor in that stage still shows up
// correctly in the "who's here right now" list further down, which falls
// back to the raw stage string for anything not in this map.
const STAGE_LABELS = {
  browsing: 'Browsing',
  cart_open: 'Cart open',
  checkout_shipping: 'Checkout — Shipping',
  checkout_payment: 'Checkout — Payment',
  purchased: 'Just purchased',
};
const STAGE_ORDER = Object.keys(STAGE_LABELS);

function pageLabel(path) {
  if (!path) return 'Unknown page';
  if (path === '/') return 'Home';
  return path;
}
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

// Same Pacific-calendar-day convention as lib/analyticsStore.js's
// todayKey() (duplicated here rather than imported, since that module also
// pulls in server-only KV env vars that have no business in the client
// bundle) — keeps "today"/"yesterday" in the date picker matching whatever
// day the order data is actually bucketed under.
const PACIFIC_DATE_FORMATTER = typeof Intl !== 'undefined'
  ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
  : null;

function dateKey(date) {
  return PACIFIC_DATE_FORMATTER ? PACIFIC_DATE_FORMATTER.format(date) : date.toISOString().slice(0, 10);
}

function todayDateKey() {
  return dateKey(new Date());
}

function yesterdayDateKey() {
  return dateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
}

const ORDER_RETENTION_DAYS = 45;

function oldestAvailableDateKey() {
  return dateKey(new Date(Date.now() - (ORDER_RETENTION_DAYS - 1) * 24 * 60 * 60 * 1000));
}

function revenueDateLabel(selectedDate) {
  if (selectedDate === todayDateKey()) return 'Today';
  if (selectedDate === yesterdayDateKey()) return 'Yesterday';
  const [y, m, d] = selectedDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

// Which ad/campaign/ad set/creative brought the buyer in, from whatever was
// captured at their first click-through (lib/attribution.js). Falls back to
// the raw click id if a platform's utm params weren't present, since
// fbclid/gclid alone still proves the visit came from a paid click.
//
// adset/ad prefer order.resolvedAdset/resolvedAd — names resolved
// server-side (pages/api/admin/orders.js, lib/metaAdsResolver.js) whenever
// the ad's own URL tags carried Meta's id-based macro
// ({{adset.id}}/{{ad.id}}) instead of the name-based one, so what was
// actually captured at click time was a bare numeric id. Falls back to the
// raw describeAdPlacement() value when no resolved name exists — no
// Marketing API token configured, resolution failed, or it just already
// was a name — so this never shows blank where the old behavior showed
// something.
function attributionSource(order) {
  const attr = order.attribution;
  if (!attr) return { source: 'Direct / organic', campaign: null, adset: null, ad: null };
  const raw = describeAdPlacement(attr);
  const adset = order.resolvedAdset || raw.adset;
  const ad = order.resolvedAd || raw.ad;
  if (attr.utm_source) return { source: attr.utm_source, campaign: attr.utm_campaign || null, adset, ad };
  if (attr.fbclid) return { source: 'Facebook/Instagram ad', campaign: null, adset, ad };
  if (attr.gclid) return { source: 'Google ad', campaign: null, adset, ad };
  return { source: 'Direct / organic', campaign: null, adset: null, ad: null };
}

const ORDER_STATUS_COLORS = {
  paid: { color: T.ink, background: T.blush },
  fulfilled: { color: T.white, background: T.ink },
  refunded: { color: '#a13d2b', background: 'rgba(161,61,43,0.1)' },
  cancelled: { color: T.soft, background: T.paper },
  archived: { color: T.soft, background: T.paper },
};

// A paid order counts as fulfilled once a tracking number has been saved.
function displayStatus(o) {
  const status = o.status || 'paid';
  return status === 'paid' && o.trackingNumber ? 'fulfilled' : status;
}

function orderStatusBadge(status) {
  const colors = ORDER_STATUS_COLORS[status] || ORDER_STATUS_COLORS.paid;
  return {
    display: 'inline-block', fontSize: 12, fontWeight: 600,
    padding: '3px 10px', borderRadius: 999, ...colors,
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [dashboard, setDashboard] = React.useState(null);
  const [funnelRange, setFunnelRange] = React.useState('today');
  const [revenueDate, setRevenueDate] = React.useState(todayDateKey());
  const [live, setLive] = React.useState({ count: 0, byStage: {}, byCountry: {}, visitors: [], activity: EMPTY_ACTIVITY, pastVisitors: [] });
  const [reviews, setReviews] = React.useState([]);
  const [reviewsLoading, setReviewsLoading] = React.useState(true);
  const [importForm, setImportForm] = React.useState({ productId: PRODUCTS[0]?.id || '', rating: 5, text: '', author: '' });
  const [importMessage, setImportMessage] = React.useState('');
  const [csvProductId, setCsvProductId] = React.useState(PRODUCTS[0]?.id || '');
  const [csvStatus, setCsvStatus] = React.useState('idle'); // idle | processing
  const [csvSummary, setCsvSummary] = React.useState(null);
  const [discounts, setDiscounts] = React.useState([]);
  const [discountForm, setDiscountForm] = React.useState({ code: '', type: 'percent', value: 10 });
  const [discountFormMessage, setDiscountFormMessage] = React.useState('');
  const [orders, setOrders] = React.useState([]);
  const [ordersLoading, setOrdersLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  // The open section rides in the URL (#orders) so a refresh keeps it.
  React.useEffect(() => {
    const fromHash = window.location.hash.replace('#', '');
    if (ADMIN_TABS.some(([k]) => k === fromHash)) setActiveTab(fromHash);
  }, []);
  const selectTab = (key) => {
    setActiveTab(key);
    window.history.replaceState(null, '', `#${key}`);
    window.scrollTo(0, 0);
  };
  const [expandedOrderId, setExpandedOrderId] = React.useState(null);
  const [showArchived, setShowArchived] = React.useState(false);
  const [orderActionBusy, setOrderActionBusy] = React.useState({});
  const [orderActionError, setOrderActionError] = React.useState({});
  const [trackingForms, setTrackingForms] = React.useState({});
  const [trackingBusy, setTrackingBusy] = React.useState({});
  const [trackingMessage, setTrackingMessage] = React.useState({});
  const [subscriptions, setSubscriptions] = React.useState([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = React.useState(true);
  const [subscriptionActionBusy, setSubscriptionActionBusy] = React.useState({});
  const [subscriptionActionError, setSubscriptionActionError] = React.useState({});

  const loadOrders = React.useCallback(() => {
    setOrdersLoading(true);
    fetch('/api/admin/orders')
      .then((r) => r.json())
      .then((data) => setOrders(data.orders || []))
      .catch(() => {})
      .finally(() => setOrdersLoading(false));
  }, []);

  React.useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadSubscriptions = React.useCallback(() => {
    setSubscriptionsLoading(true);
    fetch('/api/admin/subscriptions')
      .then((r) => r.json())
      .then((data) => setSubscriptions(data.subscriptions || []))
      .catch(() => {})
      .finally(() => setSubscriptionsLoading(false));
  }, []);

  React.useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleCancelSubscription = async (sub) => {
    if (!confirm(`Cancel the subscription for ${sub.email}? This takes effect at the end of the current billing period.`)) return;
    setSubscriptionActionBusy((prev) => ({ ...prev, [sub.id]: true }));
    setSubscriptionActionError((prev) => ({ ...prev, [sub.id]: '' }));
    try {
      const res = await fetch('/api/admin/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: sub.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not cancel this subscription.');
      setSubscriptions((prev) => prev.map((s) => (s.id === sub.id ? data.subscription : s)));
    } catch (err) {
      setSubscriptionActionError((prev) => ({ ...prev, [sub.id]: err.message }));
    } finally {
      setSubscriptionActionBusy((prev) => ({ ...prev, [sub.id]: false }));
    }
  };

  // Orders ticked in the list, for "Export selected".
  const [selectedOrders, setSelectedOrders] = React.useState([]);
  const toggleSelected = (id) => setSelectedOrders((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Just the ticked orders: who, where to ship, and what's in the order.
  const handleExportSelected = () => {
    const header = ['Order #', 'Order ID', 'Date', 'Name', 'Email', 'Phone', 'Address', 'Apt', 'City', 'State', 'ZIP', 'Items', 'Total qty'];
    const lines = orders.filter((o) => selectedOrders.includes(o.id)).map((o) => {
      const s = o.shipping || {};
      const items = o.items || [];
      return [o.orderNumber || '', o.id, new Date(o.createdAt).toLocaleString(), s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(), o.email, s.phone,
        s.address, s.apt, s.city, s.state, s.zip, items.map((i) => `${i.name} x${i.quantity || 1}`).join('; '), items.reduce((n, i) => n + Number(i.quantity || 1), 0)];
    });
    const blob = new Blob([[header, ...lines].map((l) => l.map(subscriberCsvCell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `veil-selected-orders-${lines.length}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Search box: matches name, email, phone, address, items, order number/id,
  // tracking number, amount, payment method or status. A search also looks
  // through archived orders, so an old order can always be found.
  const [orderQuery, setOrderQuery] = React.useState('');
  const visibleOrders = React.useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    if (!q) return showArchived ? orders : orders.filter((o) => o.status !== 'archived');
    const words = q.split(/\s+/);
    return orders.filter((o) => {
      const text = orderSearchText(o);
      return words.every((w) => text.includes(w) || (/^[\d\s().+-]+$/.test(w) && w.replace(/\D/g, '').length >= 3 && text.includes(w.replace(/\D/g, ''))));
    });
  }, [orders, showArchived, orderQuery]);

  const handleRefundOrder = async (order) => {
    if (!confirm(`Refund $${Number(order.amount).toFixed(2)} for this order? This can't be undone.`)) return;
    setOrderActionBusy((prev) => ({ ...prev, [order.id]: true }));
    setOrderActionError((prev) => ({ ...prev, [order.id]: '' }));
    try {
      const res = await fetch('/api/admin/orders/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, processor: order.processor, captureId: order.captureId, amount: order.amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund failed.');
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
    } catch (err) {
      setOrderActionError((prev) => ({ ...prev, [order.id]: err.message }));
    } finally {
      setOrderActionBusy((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const handleSetOrderStatus = async (order, status) => {
    if (status === 'cancelled' && !confirm('Mark this order as cancelled? This only updates its status here — it does not refund the customer.')) return;
    setOrderActionBusy((prev) => ({ ...prev, [order.id]: true }));
    setOrderActionError((prev) => ({ ...prev, [order.id]: '' }));
    try {
      const res = await fetch('/api/admin/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update this order.');
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
    } catch (err) {
      setOrderActionError((prev) => ({ ...prev, [order.id]: err.message }));
    } finally {
      setOrderActionBusy((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const getTrackingForm = (order) =>
    trackingForms[order.id] ?? {
      carrier: order.carrier || '',
      trackingNumber: order.trackingNumber || '',
      trackingUrl: order.trackingUrl || '',
    };

  const setTrackingField = (orderId, field, value) => {
    setTrackingForms((prev) => ({
      ...prev,
      [orderId]: { ...(prev[orderId] ?? getTrackingForm({ id: orderId })), [field]: value },
    }));
  };

  const handleSaveTracking = async (order) => {
    const form = getTrackingForm(order);
    if (!form.trackingNumber.trim()) {
      setTrackingMessage((prev) => ({ ...prev, [order.id]: 'Enter a tracking number.' }));
      return;
    }
    setTrackingBusy((prev) => ({ ...prev, [order.id]: true }));
    setTrackingMessage((prev) => ({ ...prev, [order.id]: '' }));
    try {
      const res = await fetch('/api/admin/orders/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save tracking.');
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data.order : o)));
      setTrackingMessage((prev) => ({
        ...prev,
        [order.id]: data.emailSent ? 'Saved — customer emailed.' : `Saved, but the email didn't send: ${data.emailError}`,
      }));
    } catch (err) {
      setTrackingMessage((prev) => ({ ...prev, [order.id]: err.message }));
    } finally {
      setTrackingBusy((prev) => ({ ...prev, [order.id]: false }));
    }
  };

  const loadDashboard = React.useCallback((range, date) => {
    fetch(`/api/admin/dashboard?range=${range}&date=${date}`).then((r) => r.json()).then(setDashboard).catch(() => {});
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
    loadReviews();
    loadDiscounts();
  }, [loadReviews, loadDiscounts]);

  // Covers the initial load and refetching when the funnel time filter or
  // the revenue/orders date picker changes, then keeps polling so new
  // activity (someone adding to cart, starting checkout) shows up here
  // without a manual reload — otherwise this panel can look stuck at zero
  // while the Live view above it (which polls on its own) shows real
  // activity happening right now.
  React.useEffect(() => {
    loadDashboard(funnelRange, revenueDate);
    const interval = setInterval(() => loadDashboard(funnelRange, revenueDate), DASHBOARD_POLL_MS);
    return () => clearInterval(interval);
  }, [loadDashboard, funnelRange, revenueDate]);

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
    if (!file || !csvProductId) return;

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
      const rating = Number(pickField(row, 'rating'));
      const text = pickField(row, 'text');
      const author = pickField(row, 'author');

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
          body: JSON.stringify({ productId: csvProductId, rating, text, author, source: 'imported' }),
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

    const productName = PRODUCTS.find((p) => p.id === csvProductId)?.name || csvProductId;
    setCsvSummary({ imported, skipped, productName });
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

      <div className="admin-shell">
        {/* Left menu (a scrolling row of tabs on phones), same layout as
            the ANESE and Smells Iconic admins. The open section is kept in
            the URL (#orders) so a refresh stays on it. */}
        <nav className="admin-nav">
          <div className="admin-nav-logo">
            <span style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 22, letterSpacing: '0.2em' }}>VEIL</span>
          </div>
          {ADMIN_TABS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => selectTab(key)} className={`admin-nav-item${activeTab === key ? ' active' : ''}`} aria-current={activeTab === key ? 'page' : undefined}>
              <AdminNavIcon name={key} />
              <span className="admin-nav-label">{label}</span>
              {key === 'orders' && orders.length > 0 && <span className="admin-nav-count">{orders.length}</span>}
              {key === 'reviews' && pendingReviews.length > 0 && <span className="admin-nav-badge">{pendingReviews.length}</span>}
              {key === 'subscriptions' && subscriptions.some((x) => x.status === 'ACTIVE') && <span className="admin-nav-count">{subscriptions.filter((x) => x.status === 'ACTIVE').length}</span>}
            </button>
          ))}
          {/* Email marketing lives on its own page (pages/admin/email.jsx). */}
          <a href="/admin/email" className="admin-nav-item"><AdminNavIcon name="email" /><span className="admin-nav-label">Email</span></a>
          <a href="/" target="_blank" rel="noopener noreferrer" className="admin-nav-item admin-nav-gap"><AdminNavIcon name="website" /><span className="admin-nav-label">Website</span></a>
          <button type="button" onClick={handleLogout} className="admin-nav-item admin-nav-quiet"><AdminNavIcon name="signout" /><span className="admin-nav-label">Sign out</span></button>
        </nav>

        <main className="admin-main">
        <h1 className="admin-serif" style={{ fontWeight: 400, fontSize: 36, lineHeight: 1.1, margin: '4px 0 24px', color: T.ink }}>{ADMIN_TABS.find(([k]) => k === activeTab)?.[1]}</h1>

        {activeTab === 'dashboard' && (
        <>
        {/* TOP STATS */}
        <div style={revenueDateRow}>
          <p style={{ ...S.label, margin: 0 }}>{revenueDateLabel(revenueDate)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setRevenueDate(todayDateKey())}
              style={revenueDate === todayDateKey() ? { ...dateQuickBtn, ...dateQuickBtnActive } : dateQuickBtn}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setRevenueDate(yesterdayDateKey())}
              style={revenueDate === yesterdayDateKey() ? { ...dateQuickBtn, ...dateQuickBtnActive } : dateQuickBtn}
            >
              Yesterday
            </button>
            <input
              type="date"
              value={revenueDate}
              min={oldestAvailableDateKey()}
              max={todayDateKey()}
              onChange={(e) => e.target.value && setRevenueDate(e.target.value)}
              style={funnelRangeSelect}
            />
          </div>
        </div>
        <div className="stat-grid" style={statGrid}>
          <StatCard label="Revenue" value={dashboard ? `$${dashboard.revenue.toFixed(2)}` : '—'} />
          <StatCard label="Orders" value={dashboard ? dashboard.orderCount : '—'} />
        </div>

        {/* LIVE VIEW — Shopify-style unified live module: big visitor count,
            funnel-stage breakdown as one segmented bar, locations,
            all in one card instead of split across several boxed sections. */}
        <div style={liveViewCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20, marginBottom: 28 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span className={live.count > 0 ? 'live-dot' : 'live-dot live-dot-idle'} />
                <span style={{ ...S.label, margin: 0 }}>Live view</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 56, letterSpacing: '-0.03em', lineHeight: 1 }}>{live.count}</div>
              <div style={{ fontSize: 13, color: T.soft, marginTop: 8 }}>
                {live.count === 0 ? 'No one on the site right now' : `visitor${live.count === 1 ? '' : 's'} on your site right now`}
              </div>
            </div>
            {live.count > 0 && (
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                {Object.entries(STAGE_LABELS).map(([key, label]) => (
                  <div key={key} style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>{live.byStage[key] || 0}</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: T.soft }}>{label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {live.count === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>Visitor locations and funnel stage will show up here as soon as someone's browsing.</p>
          ) : (
            <>
              <div style={stageBarTrack}>
                {Object.entries(STAGE_LABELS).map(([key], i) => {
                  const val = live.byStage[key] || 0;
                  const pct = (val / live.count) * 100;
                  return pct > 0 ? <div key={key} style={{ ...stageBarSeg, width: `${pct}%`, background: STAGE_BAR_COLORS[i] }} /> : null;
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 28 }}>
              {Object.entries(live.byCountry)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([code, data]) => (
                  <div key={code} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 18, width: 24, flexShrink: 0 }}>{countryFlag(code)}</span>
                      <span style={{ fontSize: 13, width: 140, flexShrink: 0 }}>{countryName(code)}</span>
                      <div style={{ flex: 1, height: 8, background: T.paper, borderRadius: 999 }}>
                        <div style={{ height: '100%', width: `${(data.count / live.count) * 100}%`, background: T.accent, borderRadius: 999 }} />
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

              <p style={{ ...S.label, margin: '28px 0 12px' }}>Who's here right now</p>
              <div>
                <div className="visitor-head-row" style={visitorHeadRow}>
                  <span className="visitor-col-stage">Stage</span>
                  <span className="visitor-col-source">Source</span>
                  <span className="visitor-col-page">Page</span>
                  <span className="visitor-col-field">Typing in</span>
                  <span className="visitor-col-scroll">Scrolled</span>
                  <span className="visitor-col-location">Location</span>
                </div>
                {live.visitors
                  .slice()
                  .sort((a, b) => STAGE_ORDER.indexOf(b.stage) - STAGE_ORDER.indexOf(a.stage) || (b.scrollPct || 0) - (a.scrollPct || 0))
                  .map((v) => {
                    const stageIndex = Math.max(0, STAGE_ORDER.indexOf(v.stage));
                    return (
                      <div key={v.sessionId} className="visitor-row" style={visitorRow}>
                        <span className="visitor-col-stage" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_BAR_COLORS[stageIndex], flexShrink: 0 }} />
                          {STAGE_LABELS[v.stage] || v.stage}
                        </span>
                        <span className="visitor-col-source" style={{ color: T.soft }} title={v.campaign || undefined}>
                          {v.source || 'Direct'}{v.campaign && ` · ${v.campaign}`}
                        </span>
                        <span className="visitor-col-page" style={{ fontFamily: 'monospace', fontSize: 12 }} title={v.path || undefined}>
                          {pageLabel(v.path)}
                        </span>
                        <span className="visitor-col-field" style={{ color: v.activeField ? T.ink : T.soft, fontStyle: v.activeField ? 'normal' : 'italic' }}>
                          {v.activeField || '—'}
                        </span>
                        <span className="visitor-col-scroll" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, background: T.paper, maxWidth: 60, borderRadius: 999 }}>
                            <div style={{ height: '100%', width: `${v.scrollPct ?? 0}%`, background: T.accent, borderRadius: 999 }} />
                          </div>
                          <span style={{ color: T.soft, fontSize: 12, flexShrink: 0 }}>{v.scrollPct != null ? `${v.scrollPct}%` : '—'}</span>
                        </span>
                        <span className="visitor-col-location" style={{ color: T.soft }}>
                          {countryFlag(v.country)} {v.city ? `${v.city}, ${v.country}` : countryName(v.country)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {/* LIVE ACTIVITY — folded into the same card as Live view above
              (same "everything live in one place" reasoning that merged
              the map/funnel/visitor-list into liveViewCard originally)
              instead of a separate bordered Section directly underneath
              it, which read as two disconnected boxes for data that's all
              the same "right now" snapshot. */}
          <p style={{ ...S.label, margin: '32px 0 18px', paddingTop: 28, borderTop: `1px solid ${T.line}` }}>Live activity (last 5 minutes)</p>
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
                      {bucket.purchase > 0 && <div style={{ flex: bucket.purchase, background: T.accent }} />}
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
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: T.accent, borderRadius: 2, marginRight: 6 }} />Purchased</span>
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
        </div>

        {/* PAYMENT METHODS */}
        <Section title={`Payment methods — ${revenueDateLabel(revenueDate)}`}>
          {!dashboard || dashboard.paymentMethods.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No orders on this date.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {dashboard.paymentMethods.map(({ method, count, revenue }) => {
                const maxCount = Math.max(...dashboard.paymentMethods.map((m) => m.count));
                return (
                  <div key={method} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 13, width: 110, flexShrink: 0 }}>{method}</span>
                    <div style={{ flex: 1, height: 8, background: T.paper, borderRadius: 999 }}>
                      <div style={{ height: '100%', width: `${(count / maxCount) * 100}%`, background: T.accent, borderRadius: 999 }} />
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
        <Section
          title={FUNNEL_RANGE_LABELS[funnelRange]}
          action={
            <select value={funnelRange} onChange={(e) => setFunnelRange(e.target.value)} style={funnelRangeSelect}>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          }
        >
          {dashboard && (
            <div className="funnel-grid" style={funnelGrid}>
              <FunnelStep label="Visitors" value={dashboard.funnel.visitors} />
              <FunnelStep label="Added to cart" value={dashboard.funnel.addToCart} rate={`${dashboard.funnel.addToCartRate}% of visitors`} />
              <FunnelStep label="Started checkout" value={dashboard.funnel.checkoutStarts} rate={`${dashboard.funnel.checkoutRate}% of adds`} />
              <FunnelStep label="Reached payment" value={dashboard.funnel.reachedPayment} rate={`${dashboard.funnel.paymentRate}% of checkouts`} />
              <FunnelStep label="Purchased" value={dashboard.funnel.purchases} rate={`${dashboard.funnel.conversionRate}% of visitors`} />
            </div>
          )}
        </Section>
        </>
        )}

        {activeTab === 'reviews' && (
        <>
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
            Choose the product these reviews are for, then upload a CSV. Columns (any order, header names are
            flexible): <strong>rating</strong> (1–5), <strong>text</strong>, <strong>author</strong>. Imported
            reviews publish immediately.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <select
              value={csvProductId}
              onChange={(e) => setCsvProductId(e.target.value)}
              disabled={csvStatus === 'processing'}
              style={{ ...formInput, width: 220 }}
            >
              {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} disabled={csvStatus === 'processing' || !csvProductId} />
          </div>
          {csvStatus === 'processing' && <p style={{ fontSize: 13, color: T.soft, marginTop: 12 }}>Importing…</p>}
          {csvSummary && (
            <div style={{ marginTop: 16, fontSize: 13 }}>
              <p style={{ color: T.ink, marginBottom: 8 }}>
                Imported {csvSummary.imported} for {csvSummary.productName}{csvSummary.skipped.length > 0 ? `, skipped ${csvSummary.skipped.length}` : ''}.
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
        </>
        )}

        {activeTab === 'discounts' && (
        <>
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
        </>
        )}

        {activeTab === 'orders' && (
        <Section
          title={`Orders (${visibleOrders.length}${orderQuery.trim() ? ` matching “${orderQuery.trim()}”` : ''})`}
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <input
                type="search"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Search name, email, phone, item, order #, tracking…"
                aria-label="Search orders"
                style={orderSearchInput}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.soft }}>
                <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} disabled={Boolean(orderQuery.trim())} />
                Show archived
              </label>
            </div>
          }
        >
          {selectedOrders.length > 0 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '0 0 12px', fontSize: 13 }}>
              <button type="button" onClick={handleExportSelected} style={{ ...S.btnFill, height: 36, padding: '0 16px', fontSize: 13 }}>
                Export {selectedOrders.length} selected to CSV
              </button>
              <button type="button" onClick={() => setSelectedOrders([])} style={{ ...S.btnOutline, height: 36, padding: '0 14px', fontSize: 12 }}>Clear</button>
            </div>
          )}
          {ordersLoading ? (
            <p style={{ color: T.soft, fontSize: 14 }}>Loading…</p>
          ) : visibleOrders.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>
              {orderQuery.trim() ? 'No orders match that search (searches the last 30 days).' : 'No orders to show.'}
            </p>
          ) : (
            // Scrolls sideways on phones instead of squeezing the columns.
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: 760 }}>
              <div style={orderHeadRow}>
                <span style={{ flex: '0 0 22px' }}>
                  {(() => {
                    const shown = visibleOrders.map((o) => o.id);
                    const all = shown.length > 0 && shown.every((id) => selectedOrders.includes(id));
                    return (
                      <input
                        type="checkbox"
                        aria-label="Select all shown orders"
                        title="Select all shown orders"
                        checked={all}
                        disabled={shown.length === 0}
                        onChange={() => setSelectedOrders(all ? selectedOrders.filter((id) => !shown.includes(id)) : [...new Set([...selectedOrders, ...shown])])}
                      />
                    );
                  })()}
                </span>
                <span style={{ flex: '0 0 64px' }}>Order</span>
                <span style={{ flex: '0 0 130px' }}>Date</span>
                <span style={{ flex: 1 }}>Items</span>
                <span style={{ flex: '0 0 90px' }}>Amount</span>
                <span style={{ flex: '0 0 100px' }}>Payment</span>
                <span style={{ flex: '0 0 90px' }}>Status</span>
              </div>
              {visibleOrders.map((o) => {
                const { source, campaign, adset, ad } = attributionSource(o);
                const itemSummary = (o.items || []).map((i) => `${i.name} ×${i.quantity}`).join(', ');
                const expanded = expandedOrderId === o.id;
                const busy = Boolean(orderActionBusy[o.id]);
                return (
                  <div key={o.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                    <div
                      style={{ ...orderRow, borderBottom: 'none', cursor: 'pointer' }}
                      onClick={() => setExpandedOrderId(expanded ? null : o.id)}
                    >
                      <span style={{ flex: '0 0 22px' }} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label="Select order" checked={selectedOrders.includes(o.id)} onChange={() => toggleSelected(o.id)} />
                      </span>
                      <span style={{ flex: '0 0 64px', fontWeight: 600 }}>{orderLabel(o)}</span>
                      <span style={{ flex: '0 0 130px', color: T.soft }}>
                        {new Date(o.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span style={{ flex: 1 }} title={itemSummary}>{itemSummary}</span>
                      <span style={{ flex: '0 0 90px' }}>${Number(o.amount).toFixed(2)}</span>
                      <span style={{ flex: '0 0 100px', color: T.soft }}>{o.paymentMethod || 'Unknown'}</span>
                      <span style={{ flex: '0 0 90px' }}>
                        <span
                          style={orderStatusBadge(displayStatus(o))}
                          title={o.trackingNumber ? `${o.carrier ? `${o.carrier} ` : ''}${o.trackingNumber}` : undefined}
                        >
                          {displayStatus(o) === 'fulfilled' ? '✓ fulfilled' : displayStatus(o)}
                        </span>
                      </span>
                    </div>

                    {expanded && (
                      <div style={orderDetail}>
                        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', marginBottom: 16 }}>
                          <div>
                            <div style={formLabel}>Order</div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{orderLabel(o)}</div>
                            <div style={{ fontSize: 11, color: T.soft, marginTop: 2, wordBreak: 'break-all' }} title="The payment company's id for this order">{o.id}</div>
                          </div>
                          <div>
                            <div style={formLabel}>Contact</div>
                            <div style={{ fontSize: 13 }}>{o.email || 'Not provided'}</div>
                          </div>
                          <div>
                            <div style={formLabel}>Shipping address</div>
                            {o.shipping ? (
                              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                                {o.shipping.name && <div>{o.shipping.name}</div>}
                                <div>{o.shipping.address}{o.shipping.apt ? `, ${o.shipping.apt}` : ''}</div>
                                <div>{o.shipping.city}, {o.shipping.state} {o.shipping.zip}</div>
                                {o.shipping.phone && <div>{o.shipping.phone}</div>}
                              </div>
                            ) : (
                              <div style={{ fontSize: 13, color: T.soft }}>Not provided</div>
                            )}
                          </div>
                          <div>
                            <div style={formLabel}>Order source</div>
                            <div style={{ fontSize: 13 }}>{source}{campaign && ` · ${campaign}`}</div>
                            {adset && <div style={{ fontSize: 13, color: T.soft, marginTop: 2 }}>Ad set: {adset}</div>}
                            {ad && <div style={{ fontSize: 13, color: T.soft, marginTop: 2 }}>Creative: {ad}</div>}
                          </div>
                          {o.shippingProtection > 0 && (
                            <div>
                              <div style={formLabel}>Shipping protection</div>
                              <div style={{ fontSize: 13 }}>Covered (${Number(o.shippingProtection).toFixed(2)} paid)</div>
                            </div>
                          )}
                        </div>

                        <div style={formLabel}>Items</div>
                        <div style={{ marginBottom: 20 }}>
                          {(o.items || []).map((i, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0' }}>
                              <span>{i.name} × {i.quantity}</span>
                              <span>${Number((i.price ?? 0) * i.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div style={formLabel}>Tracking</div>
                        <div style={{ marginBottom: 20 }}>
                          {o.trackingNumber && (
                            <div style={{ fontSize: 12, color: T.soft, marginBottom: 10 }}>
                              Shipped {o.shippedAt ? new Date(o.shippedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''} — customer emailed when last saved.
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                            <input
                              placeholder="Carrier (optional)"
                              value={getTrackingForm(o).carrier}
                              onChange={(e) => setTrackingField(o.id, 'carrier', e.target.value)}
                              style={{ ...formInput, width: 160 }}
                            />
                            <input
                              placeholder="Tracking number"
                              value={getTrackingForm(o).trackingNumber}
                              onChange={(e) => setTrackingField(o.id, 'trackingNumber', e.target.value)}
                              style={{ ...formInput, width: 200 }}
                            />
                            <input
                              placeholder="Tracking URL (optional)"
                              value={getTrackingForm(o).trackingUrl}
                              onChange={(e) => setTrackingField(o.id, 'trackingUrl', e.target.value)}
                              style={{ ...formInput, flex: 1, minWidth: 200 }}
                            />
                          </div>
                          <button
                            disabled={Boolean(trackingBusy[o.id])}
                            onClick={() => handleSaveTracking(o)}
                            style={{ ...S.btnOutline, opacity: trackingBusy[o.id] ? 0.5 : 1 }}
                          >
                            {trackingBusy[o.id] ? 'Saving…' : o.trackingNumber ? 'Update & re-email customer' : 'Save & email customer'}
                          </button>
                          {trackingMessage[o.id] && (
                            <p style={{ fontSize: 12, color: T.ink, marginTop: 8 }}>{trackingMessage[o.id]}</p>
                          )}
                        </div>

                        {orderActionError[o.id] && (
                          <p style={{ fontSize: 12, color: '#a13d2b', marginBottom: 12 }}>{orderActionError[o.id]}</p>
                        )}

                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {o.status !== 'refunded' && (
                            <button
                              disabled={busy}
                              onClick={() => handleRefundOrder(o)}
                              style={{ ...deleteBtn, opacity: busy ? 0.5 : 1 }}
                            >
                              {busy ? 'Working…' : 'Refund'}
                            </button>
                          )}
                          {o.status !== 'cancelled' && (
                            <button disabled={busy} onClick={() => handleSetOrderStatus(o, 'cancelled')} style={{ ...S.btnOutline, opacity: busy ? 0.5 : 1 }}>
                              Cancel order
                            </button>
                          )}
                          {o.status !== 'archived' ? (
                            <button disabled={busy} onClick={() => handleSetOrderStatus(o, 'archived')} style={{ ...S.btnOutline, opacity: busy ? 0.5 : 1 }}>
                              Archive
                            </button>
                          ) : (
                            <button disabled={busy} onClick={() => handleSetOrderStatus(o, 'paid')} style={{ ...S.btnOutline, opacity: busy ? 0.5 : 1 }}>
                              Restore
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </Section>
        )}

        {activeTab === 'subscriptions' && (
        <Section title={`Subscriptions (${subscriptions.length})`}>
          {subscriptionsLoading ? (
            <p style={{ color: T.soft, fontSize: 14 }}>Loading…</p>
          ) : subscriptions.length === 0 ? (
            <p style={{ color: T.soft, fontSize: 14 }}>No subscribers yet.</p>
          ) : (
            <div>
              <div style={orderHeadRow}>
                <span style={{ flex: '0 0 130px' }}>Started</span>
                <span style={{ flex: 1 }}>Customer</span>
                <span style={{ flex: 1 }}>Product</span>
                <span style={{ flex: '0 0 90px' }}>Price</span>
                <span style={{ flex: '0 0 90px' }}>Status</span>
                <span style={{ flex: '0 0 100px' }} />
              </div>
              {subscriptions.map((s) => {
                const busy = Boolean(subscriptionActionBusy[s.id]);
                return (
                  <div key={s.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                    <div style={orderRow}>
                      <span style={{ flex: '0 0 130px', color: T.soft }}>
                        {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span style={{ flex: 1 }} title={s.email}>{s.email}</span>
                      <span style={{ flex: 1 }}>{s.productName} <span style={{ color: T.soft }}>· every {s.cadenceDays || 60}d</span></span>
                      <span style={{ flex: '0 0 90px' }}>${Number(s.price).toFixed(2)}</span>
                      <span style={{ flex: '0 0 90px' }}>
                        <span style={orderStatusBadge(s.status === 'ACTIVE' ? 'paid' : s.status === 'CANCELED' ? 'cancelled' : 'archived')}>
                          {(s.status || 'active').toLowerCase()}
                        </span>
                      </span>
                      <span style={{ flex: '0 0 100px' }}>
                        {s.status !== 'CANCELED' && (
                          <button disabled={busy} onClick={() => handleCancelSubscription(s)} style={{ ...deleteBtn, opacity: busy ? 0.5 : 1 }}>
                            {busy ? 'Working…' : 'Cancel'}
                          </button>
                        )}
                      </span>
                    </div>
                    {subscriptionActionError[s.id] && (
                      <p style={{ fontSize: 12, color: '#a13d2b', padding: '0 0 12px' }}>{subscriptionActionError[s.id]}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Section>
        )}

        {/* Paths to purchase (components/PathsTree.jsx, lib/journeys.js). */}
        {activeTab === 'paths' && (
          <Section title="Paths to purchase">
            <PathsTree />
          </Section>
        )}

        {activeTab === 'visitors' && <VisitorsTab />}
        {activeTab === 'subscribers' && <SubscribersTab />}
        </main>
      </div>

      <style jsx>{`
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .funnel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        @media (max-width: 640px) {
          .stat-grid { grid-template-columns: 1fr; }
          .funnel-grid { grid-template-columns: repeat(2, 1fr); }
        }
        .visitor-head-row, .visitor-row { display: flex; }
        .visitor-col-stage { flex: 0 0 110px; }
        .visitor-col-source { flex: 0 0 150px; }
        .visitor-col-page { flex: 1; }
        .visitor-col-field { flex: 0 0 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .visitor-col-scroll { flex: 0 0 130px; }
        .visitor-col-location { flex: 0 0 120px; }
        .visitor-col-when { flex: 0 0 90px; text-align: right; }
        @media (max-width: 640px) {
          .visitor-head-row { display: none; }
          .visitor-row { flex-wrap: wrap; row-gap: 6px; }
          .visitor-col-stage { flex: 1 1 50%; order: 1; }
          .visitor-col-location { flex: 1 1 50%; order: 2; text-align: right; }
          .visitor-col-source { flex: 1 1 100%; order: 3; }
          .visitor-col-page { flex: 1 1 60%; order: 4; }
          .visitor-col-field { flex: 1 1 100%; order: 5; text-align: right; white-space: normal; }
          .visitor-col-scroll { flex: 1 1 40%; order: 6; justify-content: flex-end; }
          .visitor-col-when { flex: 1 1 40%; order: 6; }
        }
        .live-dot {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
          background: #22c55e;
          box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5);
          animation: live-pulse 2s infinite;
        }
        .live-dot-idle {
          background: ${T.line};
          box-shadow: none;
          animation: none;
        }
        @keyframes live-pulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
          70% { box-shadow: 0 0 0 8px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div style={{ ...statCard, ...(highlight ? { boxShadow: `inset 0 0 0 2px ${T.accent}, ${T.shadow}` } : {}) }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: T.soft, marginBottom: 6 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 32, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function FunnelStep({ label, value, rate }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 500, color: T.soft }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em' }}>{value ?? 0}</div>
      {rate && <div style={{ fontSize: 12, color: T.accent, fontWeight: 500, marginTop: 2 }}>{rate}</div>}
    </div>
  );
}



// Admin → Visitors (same as the Smells Iconic admin): everyone who visited,
// newest first, with where they came from, their URL parameters, what they
// did, and — for those who didn't buy — where they stopped
// (pages/api/admin/visitors.js).
function checkoutStepFor(label) {
  const l = String(label || '').toLowerCase();
  if (!l) return null;
  if (l.includes('email')) return 'Contact';
  if (/card|expir|security|cvc|cvv/.test(l)) return 'Payment';
  if (l.includes('discount')) return 'Discount code';
  if (/name|address|apartment|city|state|zip|phone|country/.test(l)) return 'Shipping';
  return null;
}

// One-line outcome for a visitor: bought, where they left checkout, added
// to cart only, or just browsed — with "now" for recent activity.
function visitorStatus(j) {
  if (!j) return { kind: 'browse', text: 'Browsed only' };
  if (j.purchased) return { kind: 'purchase', text: `Purchased${j.purchased.amount ? ` · $${Number(j.purchased.amount).toFixed(2)}` : ''}` };
  const active = j.lastSeen && Date.now() - j.lastSeen < 2 * 60 * 1000;
  if (j.checkoutAt) {
    const field = j.lastField && (String(j.lastField.path || '').startsWith('/checkout') || checkoutStepFor(j.lastField.label)) ? j.lastField.label : null;
    const step = checkoutStepFor(field);
    if (active) return { kind: 'checkout', text: `At checkout now${field ? ` · typing in “${field}”` : ''}` };
    return {
      kind: 'checkout',
      text: field
        ? `Abandoned checkout at ${step || 'checkout'} — last typed in “${field}”`
        : 'Abandoned checkout before typing anything',
    };
  }
  if (j.cart?.length) return { kind: 'cart', text: `${active ? 'Has items in cart' : 'Abandoned cart'} — added ${j.cart.join(', ')}` };
  return { kind: 'browse', text: active ? 'Browsing now' : 'Browsed only' };
}

const STATUS_COLORS = { purchase: T.ink, checkout: T.ink, cart: T.soft, browse: T.soft };
const STATUS_FILTERS = [['all', 'All'], ['cart', 'Added to cart'], ['checkout', 'Reached checkout'], ['purchase', 'Purchased']];

// Subscribers tab: everyone who has given an email or phone — email signups,
// text-alert opt-ins, checkouts (paid or abandoned) and customers — with
// whether they bought, what was left in an abandoned cart, and whether
// they're on the email list (pages/api/admin/subscribers.js). Adding,
// suppressing and sending emails stay on the Email page.
const SUB_FILTERS = [['all', 'All'], ['abandoned', 'Abandoned checkout'], ['customers', 'Customers'], ['signups', 'Signups'], ['optedin', 'Emails OK'], ['texts', 'Texts OK'], ['automated', 'Sent an automation'], ['noautomation', 'No automation yet']];
const SUB_SOURCE_LABELS = { checkout: 'checkout', order: 'order', texts: 'text alerts', shopify: 'Shopify', manual: 'added by hand', lead: 'checkout', newsletter: 'signup' };

function subscriberStatus(s) {
  if (s.orders?.count) return { kind: 'customer', label: `Customer · ${s.orders.count} order${s.orders.count === 1 ? '' : 's'} · $${s.orders.spent.toFixed(2)}`, color: T.ink };
  if (s.lastCheckoutAt) return { kind: 'abandoned', label: 'Abandoned checkout', color: '#a13d2b' };
  if (s.sources?.includes('order')) return { kind: 'customer', label: 'Customer', color: T.ink };
  return { kind: 'signup', label: s.sources?.includes('texts') && !s.email ? 'Text alerts signup' : 'Signup', color: T.soft };
}

function subscriberCart(s) {
  const items = s.cart || [];
  const total = s.cartValue || items.reduce((t, i) => t + (Number(i.price) || 0) * (i.quantity || 1), 0);
  return `${items.map((i) => `${i.name} ×${i.quantity || 1}`).join(', ')}${total ? ` ($${total.toFixed(2)})` : ''}`;
}

function subscriberCsvCell(v) {
  const t = v == null ? '' : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

const shortDate = (v) => (v ? new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

function SubscribersTab() {
  const [list, setList] = React.useState(null);
  const [error, setError] = React.useState('');
  const [filter, setFilter] = React.useState('all');
  const [query, setQuery] = React.useState('');

  const load = React.useCallback(() => {
    setError('');
    fetch('/api/admin/subscribers')
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.error || 'Could not load subscribers.')))))
      .then((d) => setList(d.subscribers || []))
      .catch((err) => setError(err.message));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const matches = (s, f) => {
    const st = subscriberStatus(s).kind;
    if (f === 'abandoned') return st === 'abandoned';
    if (f === 'customers') return st === 'customer';
    if (f === 'signups') return st === 'signup';
    if (f === 'optedin') return Boolean(s.consent);
    if (f === 'texts') return Boolean(s.textsOk);
    if (f === 'automated') return s.automations?.length > 0;
    if (f === 'noautomation') return Boolean(s.email) && !s.automations?.length;
    return true;
  };
  const counts = React.useMemo(() => Object.fromEntries(SUB_FILTERS.map(([k]) => [k, (list || []).filter((s) => matches(s, k)).length])), [list]);
  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list || []).filter((s) => matches(s, filter) && (!q || [s.email, s.phone, s.name, s.city, s.state, ...(s.cart || []).map((i) => i.name)].filter(Boolean).join(' ').toLowerCase().includes(q)));
  }, [list, filter, query]);

  const exportCsv = () => {
    const header = ['Email', 'Phone', 'Name', 'City', 'State', 'Status', 'Email list', 'Texts OK', 'Sources', 'Abandoned cart', 'Automations sent', 'First seen', 'Last seen'];
    const lines = rows.map((s) => [s.email, s.phone, s.name, s.city, s.state, subscriberStatus(s).label, s.status || '', s.textsOk ? 'yes' : 'no', (s.sources || []).join(' '),
      subscriberStatus(s).kind === 'abandoned' ? subscriberCart(s) : '',
      (s.automations || []).map((a) => `${a.flow} email ${a.step} (${a.sentAt ? new Date(a.sentAt).toLocaleString() : '?'})`).join('; '),
      s.firstSeen ? new Date(s.firstSeen).toLocaleString() : '', s.lastSeen ? new Date(s.lastSeen).toLocaleString() : ''].map(subscriberCsvCell).join(','));
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `veil-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Section
      title={list ? `${rows.length} ${rows.length === 1 ? 'person' : 'people'}` : 'Subscribers'}
      action={<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a href="/admin/email" style={S.btnOutline}>Email tools</a>
        <button type="button" onClick={exportCsv} disabled={!rows.length} style={S.btnOutline}>Export CSV</button>
        <button type="button" onClick={load} style={S.btnOutline}>Refresh</button>
      </div>}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {SUB_FILTERS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setFilter(key)} style={{ ...chip, cursor: 'pointer', background: filter === key ? T.ink : 'rgba(0,0,0,0.05)', color: filter === key ? T.white : T.ink }}>{label} · {counts[key] ?? 0}</button>
        ))}
      </div>
      <input placeholder="Search email, phone, name, city, product…" value={query} onChange={(e) => setQuery(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', border: '1px solid rgba(0,0,0,0.12)', background: T.white, fontSize: 14, marginBottom: 16 }} />

      {list === null && !error && <p style={{ color: T.soft, fontSize: 14 }}>Loading…</p>}
      {error && <p style={{ color: '#a13d2b', fontSize: 14 }}>{error}</p>}
      {list && rows.length === 0 && <p style={{ color: T.soft, fontSize: 14 }}>No one here yet. People appear as soon as they sign up or type their email at checkout.</p>}

      {rows.map((s) => {
        const st = subscriberStatus(s);
        return (
          <div key={s.key} style={{ padding: '14px 0', borderTop: `1px solid ${T.line}`, fontSize: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ wordBreak: 'break-word' }}>
                <span style={{ fontWeight: 600 }}>{s.name || s.email || s.phone}</span>
                {s.name && s.email && <span style={{ color: T.soft }}> · {s.email}</span>}
                {s.phone && (s.name || s.email) && <span style={{ color: T.soft }}> · {s.phone}</span>}
              </span>
              <span style={{ color: T.soft, fontSize: 13 }}>
                {[s.city, s.state].filter(Boolean).join(', ')}{(s.city || s.state) ? ' · ' : ''}last seen {shortDate(s.lastSeen)}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
              <span style={{ fontWeight: 600, color: st.color }}>{st.label}</span>
              {st.kind === 'abandoned' && s.cart?.length > 0 && <span style={{ color: T.soft }}>left {subscriberCart(s)}</span>}
              <span style={{ color: T.soft, fontSize: 13 }}>via {(s.sources || []).map((x) => SUB_SOURCE_LABELS[x] || x).filter((x, i, a) => a.indexOf(x) === i).join(', ')}</span>
              {s.email && (
                <span title="Whether they're on the email list (manage on the Email page)"
                  style={{ ...chip, background: s.consent ? T.blush : T.white, color: s.consent ? T.ink : T.soft }}>
                  {s.consent ? 'Emails OK' : s.status ? `Email: ${s.status}` : 'Not on email list'}
                </span>
              )}
              {s.textsOk && <span style={{ ...chip, background: T.blush, color: T.ink }}>Texts OK</span>}
            </div>
            {s.email && (
              <div style={{ marginTop: 6, fontSize: 13, color: T.soft }}>
                {s.automations?.length ? (
                  <>
                    <span>Automations sent:</span>
                    {s.automations.map((a) => (
                      <div key={`${a.flowId}:${a.step}:${a.sentAt}`} style={{ paddingLeft: 12 }}>
                        <span style={{ color: T.ink }}>{a.flow}</span> · email {a.step}{a.steps > 1 ? ` of ${a.steps}` : ''}
                        {a.subject && <> · &ldquo;{a.subject}&rdquo;</>} · {shortDate(a.sentAt)}
                      </div>
                    ))}
                  </>
                ) : 'No automation emails sent yet'}
              </div>
            )}
          </div>
        );
      })}
    </Section>
  );
}

// "New" or "3rd visit": how many days this device has visited, this one
// included (lib/analyticsStore.js countVisit). Nothing for visits logged
// before counting began.
function ordinal(n) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
}

function VisitTag({ n }) {
  if (!n) return null;
  const returning = n > 1;
  return (
    <span style={{
      marginLeft: 8, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, verticalAlign: 'middle',
      background: returning ? '#E3F1E4' : '#F1EEEA', color: returning ? '#1F6B2E' : '#6B625A',
    }}
    >
      {returning ? `${ordinal(n)} visit` : 'New'}
    </span>
  );
}

function VisitorsTab() {
  const [visitors, setVisitors] = React.useState(null);
  const [error, setError] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [onlyTagged, setOnlyTagged] = React.useState(false);
  const [onlyReturning, setOnlyReturning] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState('all');

  const load = React.useCallback(() => {
    setError('');
    fetch('/api/admin/visitors', { cache: 'no-store' })
      .then((r) => r.json().then((d) => (r.ok ? d : Promise.reject(new Error(d.error || 'Could not load visitors.')))))
      .then((d) => setVisitors(d.visitors || []))
      .catch((err) => setError(err.message));
  }, []);
  React.useEffect(() => {
    load();
    const id = setInterval(load, 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return (visitors || []).filter((v) => {
      const params = v.params || {};
      if (onlyTagged && Object.keys(params).length === 0) return false;
      if (onlyReturning && !(v.visitNumber > 1)) return false;
      const j = v.journey;
      if (statusFilter === 'purchase' && !j?.purchased) return false;
      if (statusFilter === 'checkout' && !j?.checkoutAt) return false;
      if (statusFilter === 'cart' && !j?.cart?.length) return false;
      if (!q) return true;
      const hay = [v.source, v.campaign, v.landing, v.referrer, v.city, v.country, v.device, ...Object.entries(params).map(([k, val]) => `${k}=${val}`)]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [visitors, query, onlyTagged, onlyReturning, statusFilter]);

  const statusCounts = React.useMemo(() => {
    const list = visitors || [];
    return {
      all: list.length,
      cart: list.filter((v) => v.journey?.cart?.length).length,
      checkout: list.filter((v) => v.journey?.checkoutAt).length,
      purchase: list.filter((v) => v.journey?.purchased).length,
    };
  }, [visitors]);

  const topSources = React.useMemo(() => {
    const counts = new Map();
    for (const v of rows) counts.set(v.source || 'Direct', (counts.get(v.source || 'Direct') || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  const chipBtn = (on) => ({ ...chip, cursor: 'pointer', background: on ? T.ink : 'rgba(0,0,0,0.05)', color: on ? T.white : T.ink });

  return (
    <>
      <Section title="Visitors by source" action={<button type="button" onClick={load} style={S.btnOutline}>Refresh</button>}>
        {visitors === null && !error && <p style={{ fontSize: 14 }}>Loading…</p>}
        {error && <p style={{ color: '#a13d2b', fontSize: 14 }}>{error}</p>}
        {visitors && topSources.length === 0 && <p style={{ fontSize: 14, opacity: 0.7 }}>No visitors recorded yet. New visits show up here from now on.</p>}
        {topSources.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {topSources.map(([source, count]) => (
              <button key={source} type="button" onClick={() => setQuery(source === query ? '' : source)} style={chipBtn(query === source)}>
                {source} · {count}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title={`Recent visitors (${rows.length}${visitors && rows.length !== visitors.length ? ` of ${visitors.length}` : ''})`}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {STATUS_FILTERS.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setStatusFilter(key)} style={chipBtn(statusFilter === key)}>
              {label} · {statusCounts[key]}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            placeholder="Search source, page, city, utm_campaign=…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, minWidth: 220, height: 40, padding: '0 12px', border: '1px solid rgba(0,0,0,0.12)', background: T.white, fontSize: 14 }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={onlyTagged} onChange={(e) => setOnlyTagged(e.target.checked)} />
            Only visits with URL parameters
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input type="checkbox" checked={onlyReturning} onChange={(e) => setOnlyReturning(e.target.checked)} />
            Only returning visitors
          </label>
        </div>
        <div style={{ maxHeight: 720, overflowY: 'auto' }}>
          {rows.map((v) => {
            const params = Object.entries(v.params || {});
            const place = [v.city, v.country].filter(Boolean).join(', ');
            const j = v.journey;
            const status = visitorStatus(j);
            const scrolls = Object.entries(j?.scroll || {});
            return (
              <div key={`${v.sessionId}-${v.ts}`} style={visitorListRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600 }}>{v.source || 'Direct'}{v.campaign ? ` · ${v.campaign}` : ''}<VisitTag n={v.visitNumber} /></span>
                  <span style={{ fontSize: 13, opacity: 0.7 }}>
                    {new Date(v.ts).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    {place && ` · ${place}`}{v.device && ` · ${v.device}`}
                    {v.outsideServiceArea && ' · outside the US'}
                  </span>
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  <span style={{ opacity: 0.7 }}>Landed on </span>{v.landing || '/'}
                  {v.referrer && <span style={{ opacity: 0.7 }}> · from <span title={v.referrer}>{v.referrer.length > 70 ? `${v.referrer.slice(0, 70)}…` : v.referrer}</span></span>}
                </div>
                <div style={{ fontSize: 14, marginTop: 6, fontWeight: 600, color: STATUS_COLORS[status.kind] }}>{status.text}</div>
                {j?.pages?.length > 0 && (
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Viewed {j.pages.join(' · ')}</div>
                )}
                {j?.cartSteps?.length > 0 && (
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>Cart trail: {j.cartSteps.join(' → ')}</div>
                )}
                {scrolls.length > 0 && (
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                    Scrolled {scrolls.map(([path, pct]) => `${path} ${pct}%`).join(' · ')}
                  </div>
                )}
                {params.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {params.map(([k, val]) => (
                      <span key={k} style={chip} title={`${k}=${val}`}>
                        <span style={{ opacity: 0.6 }}>{k}</span>=<span>{val.length > 60 ? `${val.slice(0, 60)}…` : val}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

const visitorListRow = { padding: '14px 0', borderTop: `1px solid ${T.line}`, fontSize: 14 };
const chip = { display: 'inline-block', border: 'none', background: 'rgba(0,0,0,0.05)', padding: '5px 12px', fontSize: 13, fontWeight: 500, borderRadius: 999, wordBreak: 'break-all' };

// Everything the Orders search box matches against, lowercased. Phone
// numbers are added as bare digits too, so "555-0100" finds "(555) 010-0100".
function orderSearchText(o) {
  const sh = o.shipping || {};
  return [
    o.id, o.orderNumber, o.orderNumber && `#${o.orderNumber}`, o.email, displayStatus(o), o.paymentMethod, o.trackingNumber, o.carrier,
    sh.name, sh.address, sh.apt, sh.city, sh.state, sh.zip, sh.phone, String(sh.phone || '').replace(/\D/g, ''),
    ...(o.items || []).map((i) => i.name),
    Number.isFinite(Number(o.amount)) ? Number(o.amount).toFixed(2) : '',
  ].filter(Boolean).join(' ').toLowerCase();
}

function Section({ title, action, children }) {
  return (
    <div style={{ background: T.white, borderRadius: T.radius, boxShadow: cardShadow, padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em', color: T.ink }}>{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

// Same white/border palette as before — this just lifts each card off the
// paper background a little instead of leaving them perfectly flat.
const cardShadow = T.shadow;
// gridTemplateColumns comes from the .stat-grid class, so phones can change it.
const statGrid = { display: 'grid', gap: 16, marginBottom: 24 };
const statCard = { background: T.white, borderRadius: T.radius, boxShadow: cardShadow, padding: '20px 22px' };
// gridTemplateColumns is deliberately left out and set by the .funnel-grid
// CSS class instead (see <style jsx> below) — an inline value here would
// always beat that class's mobile media-query override, regardless of
// specificity, the same footgun already documented on mobileTopbar in
// pages/checkout.jsx.
const funnelGrid = { display: 'grid', gap: 16 };
const liveViewCard = { background: T.white, borderRadius: T.radius, boxShadow: cardShadow, padding: '24px', marginBottom: 20 };
const stageBarTrack = { display: 'flex', height: 10, width: '100%', background: T.paper, overflow: 'hidden', borderRadius: 999 };
const stageBarSeg = { height: '100%', transition: 'width .3s ease' };
// Lightest (browsing) to darkest (just purchased), same "further down the
// funnel = more solid" convention as the live-activity sparkline below.
// One entry per STAGE_LABELS key, in order.
const STAGE_BAR_COLORS = [
  'rgba(20,20,20,0.2)', 'rgba(20,20,20,0.4)',
  'rgba(20,20,20,0.65)', 'rgba(20,20,20,0.85)',
  T.accent,
];
// display is intentionally left out of these two and set in CSS instead
// (.visitor-head-row/.visitor-row below) — an inline `display` would always
// beat the mobile media query's `display: none` / `flex-wrap`, regardless
// of specificity.
const visitorHeadRow = {
  gap: 12, padding: '0 0 8px', borderBottom: `1px solid ${T.line}`,
  fontSize: 12, fontWeight: 500, color: T.soft,
};
const visitorRow = {
  gap: 12, padding: '10px 0', borderBottom: `1px solid ${T.line}`,
  fontSize: 13, alignItems: 'center',
};
const orderSearchInput = {
  height: 36, width: 300, maxWidth: '100%', padding: '0 14px', fontSize: 14,
  border: '1px solid rgba(0,0,0,0.12)', borderRadius: 980, background: T.white, color: T.ink, fontFamily: 'inherit',
};

const funnelRangeSelect = {
  height: 34, padding: '0 10px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 8, background: T.white,
  fontFamily: T.sans, fontSize: 13, color: T.ink, outline: 'none',
};
const revenueDateRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  flexWrap: 'wrap', gap: 12, marginBottom: 12,
};
const dateQuickBtn = {
  height: 32, padding: '0 14px', border: 'none', borderRadius: 980, background: 'rgba(0,0,0,0.05)',
  fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink, cursor: 'pointer',
};
const dateQuickBtnActive = { background: T.ink, color: T.white, fontWeight: 600 };
const orderHeadRow = {
  display: 'flex', gap: 12, padding: '0 0 10px', borderBottom: `1px solid ${T.line}`,
  fontSize: 12, fontWeight: 500, color: T.soft,
};
const orderRow = {
  display: 'flex', gap: 12, padding: '12px 0', borderBottom: `1px solid ${T.line}`,
  fontSize: 13, alignItems: 'center',
};
const orderDetail = { padding: '4px 0 20px', borderBottom: `1px solid ${T.line}` };
const ADMIN_TABS = [
  ['dashboard', 'Dashboard'],
  ['orders', 'Orders'],
  ['visitors', 'Visitors'],
  ['subscribers', 'Subscribers'],
  ['subscriptions', 'Subscriptions'],
  ['reviews', 'Reviews'],
  ['discounts', 'Discounts'],
  ['paths', 'Paths'],
];

const reviewRow = { display: 'flex', gap: 16, alignItems: 'flex-start', padding: '14px 0', borderBottom: `1px solid ${T.line}` };
const deleteBtn = {
  fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 980,
  background: 'rgba(255,59,48,0.1)', padding: '7px 14px', cursor: 'pointer', fontFamily: T.sans, flexShrink: 0, color: '#D70015',
};
const formInput = {
  width: '100%', height: 40, padding: '0 12px', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 10, background: T.white,
  fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box',
};
const formLabel = {
  display: 'block', fontSize: 12, fontWeight: 500, color: T.soft, marginBottom: 6,
};
