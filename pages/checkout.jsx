import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import { useCart } from '../lib/useCart';
import { tokenizeCard } from '../lib/qbPayments';
import { T, S } from '../lib/theme';

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const emptyAddress = { firstName: '', lastName: '', address: '', apt: '', city: '', state: '', zip: '', phone: '' };

function AddressFields({ value, onChange, idPrefix }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });
  return (
    <>
      <div className="row-2">
        <input placeholder="First name" value={value.firstName} onChange={set('firstName')} style={input} required />
        <input placeholder="Last name" value={value.lastName} onChange={set('lastName')} style={input} required />
      </div>
      <input placeholder="Address" value={value.address} onChange={set('address')} style={{ ...input, marginTop: 12 }} required />
      <input placeholder="Apartment, suite, etc. (optional)" value={value.apt} onChange={set('apt')} style={{ ...input, marginTop: 12 }} />
      <div className="row-3" style={{ marginTop: 12 }}>
        <input placeholder="City" value={value.city} onChange={set('city')} style={input} required />
        <select value={value.state} onChange={set('state')} style={input} required>
          <option value="">State</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="ZIP code" value={value.zip} onChange={set('zip')} style={input} required />
      </div>
      <input
        placeholder="Phone (optional)"
        value={value.phone}
        onChange={set('phone')}
        style={{ ...input, marginTop: 12 }}
        id={idPrefix ? `${idPrefix}-phone` : undefined}
      />
    </>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, total, hydrated, clear } = useCart();

  const [email, setEmail] = React.useState('');
  const [newsletter, setNewsletter] = React.useState(true);
  const [shipping, setShipping] = React.useState(emptyAddress);
  const [billingSame, setBillingSame] = React.useState(true);
  const [billing, setBilling] = React.useState(emptyAddress);
  const [card, setCard] = React.useState({ number: '', expiry: '', cvc: '', name: '' });
  const [discountCode, setDiscountCode] = React.useState('');
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (hydrated && cart.length === 0) router.replace('/shop');
  }, [hydrated, cart.length, router]);

  const shippingCost = total >= 50 || cart.length === 0 ? 0 : 6;
  const grandTotal = total + shippingCost;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const [expMonth, expYear] = card.expiry.split('/').map((s) => s.trim());
      const token = await tokenizeCard({
        number: card.number,
        expMonth,
        expYear: expYear && expYear.length === 2 ? `20${expYear}` : expYear,
        cvc: card.cvc,
        name: card.name,
        postalCode: (billingSame ? shipping.zip : billing.zip),
      });

      const res = await fetch('/api/qb-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          amount: grandTotal,
          items: cart,
          email,
          shipping,
          billing: billingSame ? shipping : billing,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment failed');

      await router.push('/success');
      clear();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!hydrated || cart.length === 0) return null;

  return (
    <div>
      <header style={topbar}>
        <Link href="/" style={{ ...S.wrap, display: 'flex', alignItems: 'center', height: 64, textDecoration: 'none' }}>
          <span style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 22, letterSpacing: '0.3em', color: T.ink }}>VEIL</span>
        </Link>
      </header>

      <button className="summary-toggle" style={summaryToggle} onClick={() => setSummaryOpen((o) => !o)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{summaryOpen ? 'Hide' : 'Show'} order summary</span>
          <span style={{ fontSize: 10 }}>{summaryOpen ? '▲' : '▼'}</span>
        </span>
        <span style={{ fontFamily: T.serif, fontSize: 17 }}>${grandTotal.toFixed(2)}</span>
      </button>

      <div className="checkout-grid" style={checkoutGrid}>
        <form onSubmit={handleSubmit} style={formCol}>
          <section>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Contact</h2>
            </div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={input}
              required
            />
            <label style={checkboxLabel}>
              <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} />
              Email me with news and offers
            </label>
          </section>

          <section style={{ marginTop: 36 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Delivery</h2>
            </div>
            <select value="United States" readOnly style={{ ...input, marginBottom: 12, color: T.soft }}>
              <option>United States</option>
            </select>
            <AddressFields value={shipping} onChange={setShipping} idPrefix="ship" />
          </section>

          <section style={{ marginTop: 36 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Shipping method</h2>
            </div>
            <div style={shipMethod}>
              <span>Standard Shipping</span>
              <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
            </div>
          </section>

          <section style={{ marginTop: 36 }}>
            <div style={sectionHead}>
              <h2 style={sectionTitle}>Payment</h2>
              <span style={{ fontSize: 11, color: T.soft }}>All transactions are secure and encrypted.</span>
            </div>
            <input
              placeholder="Card number"
              value={card.number}
              onChange={(e) => setCard({ ...card, number: e.target.value })}
              style={input}
              inputMode="numeric"
              required
            />
            <div className="row-2" style={{ marginTop: 12 }}>
              <input
                placeholder="Expiration date (MM/YY)"
                value={card.expiry}
                onChange={(e) => setCard({ ...card, expiry: e.target.value })}
                style={input}
                required
              />
              <input
                placeholder="Security code"
                value={card.cvc}
                onChange={(e) => setCard({ ...card, cvc: e.target.value })}
                style={input}
                inputMode="numeric"
                required
              />
            </div>
            <input
              placeholder="Name on card"
              value={card.name}
              onChange={(e) => setCard({ ...card, name: e.target.value })}
              style={{ ...input, marginTop: 12 }}
              required
            />
            <label style={checkboxLabel}>
              <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} />
              Use shipping address as billing address
            </label>
            {!billingSame && (
              <div style={{ marginTop: 16 }}>
                <AddressFields value={billing} onChange={setBilling} idPrefix="bill" />
              </div>
            )}
          </section>

          {error && <p style={errorText}>{error}</p>}

          <button type="submit" disabled={submitting} style={{ ...S.btnFill, width: '100%', justifyContent: 'center', marginTop: 32, opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Processing…' : `Pay now — $${grandTotal.toFixed(2)}`}
          </button>
        </form>

        <aside className={`order-summary ${summaryOpen ? 'open' : ''}`} style={summaryCol}>
          <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 20 }}>
            {cart.map((item) => (
              <div key={item.id} style={summaryItem}>
                <div style={summaryImgWrap}>
                  <ProductVisual id={item.id} image={item.image} alt={item.name} width={48} />
                  <span style={qtyBadge}>{item.quantity}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: T.soft, marginTop: 2 }}>{item.size}</div>
                </div>
                <div style={{ fontSize: 14 }}>${(item.price * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              placeholder="Discount code"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              style={{ ...input, flex: 1 }}
            />
            <button type="button" style={S.btnOutline}>Apply</button>
          </div>

          <div style={summaryRow}>
            <span style={{ color: T.soft }}>Subtotal</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <div style={summaryRow}>
            <span style={{ color: T.soft }}>Shipping</span>
            <span>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
          </div>
          <div style={{ ...summaryRow, borderTop: `1px solid ${T.line}`, paddingTop: 16, marginTop: 6 }}>
            <span style={{ fontFamily: T.serif, fontSize: 18 }}>Total</span>
            <span style={{ fontFamily: T.serif, fontSize: 24 }}>${grandTotal.toFixed(2)}</span>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .row-3 { display: grid; grid-template-columns: 1.4fr 0.8fr 1fr; gap: 12px; }
        .summary-toggle { display: none; }
        .checkout-grid { grid-template-columns: 1fr 1fr; }
        .order-summary { display: block; }
        @media (max-width: 860px) {
          .checkout-grid { grid-template-columns: 1fr; }
          .summary-toggle { display: flex; }
          .order-summary { display: none; }
          .order-summary.open { display: block; }
        }
        @media (max-width: 520px) {
          .row-3 { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

const topbar = { borderBottom: `1px solid ${T.line}`, textAlign: 'center' };
const summaryToggle = {
  width: '100%', border: 'none', borderBottom: `1px solid ${T.line}`, background: T.paper,
  padding: '16px 24px', alignItems: 'center', justifyContent: 'space-between',
  cursor: 'pointer', fontFamily: T.sans, fontSize: 13, color: T.ink,
};
const checkoutGrid = { display: 'grid', maxWidth: 1100, margin: '0 auto' };
const formCol = { padding: '48px 40px', borderRight: `1px solid ${T.line}` };
const summaryCol = { padding: '48px 40px', background: T.paper };
const sectionHead = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16, flexWrap: 'wrap', gap: 8 };
const sectionTitle = { fontFamily: T.serif, fontWeight: 300, fontSize: 22, margin: 0 };
const input = {
  width: '100%', height: 46, padding: '0 14px', border: `1px solid ${T.line}`, background: T.white,
  fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', boxSizing: 'border-box', borderRadius: 0,
};
const checkboxLabel = { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 13, color: T.soft };
const shipMethod = {
  display: 'flex', justifyContent: 'space-between', padding: '16px 14px',
  border: `1px solid ${T.ink}`, fontSize: 14,
};
const errorText = { color: '#a13d2b', fontSize: 13, marginTop: 20 };
const summaryItem = { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0' };
const summaryImgWrap = { position: 'relative', width: 48, height: 48, flexShrink: 0, overflow: 'hidden', border: `1px solid ${T.line}`, background: T.white };
const qtyBadge = {
  position: 'absolute', top: -8, right: -8, background: T.soft, color: T.white, borderRadius: '50%',
  width: 18, height: 18, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const summaryRow = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 14 };
