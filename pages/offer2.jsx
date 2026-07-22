import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import { useCart } from '../lib/useCart';
import { useAllReviews } from '../lib/useReviews';
import { PRODUCTS, getProductById } from '../lib/products';
import { T, S } from '../lib/theme';

// Second step of the ad funnel — a conventional hero/benefits/guarantee/
// reviews landing page, distinct in structure from the /offer advertorial
// "story" page that leads into it. This page's CTAs carry the chosen scent
// on to /offer3, the single-page order form (scent/quantity + shipping +
// payment) — /offer2 itself doesn't touch the cart or checkout directly.
//
// Same honesty rule as /offer: every claim, badge, and guarantee term below
// is something VEIL actually backs up elsewhere on the site (lib/products.js,
// pages/returns.jsx, pages/shipping.jsx). No fabricated press logos, no
// invented accreditation badges, no review counts beyond what /api/reviews
// actually has, no guarantee terms VEIL doesn't really offer.

const DISCOUNT_CODE = 'VEIL15';
const SCENT_IDS = ['original', 'citron', 'violette', 'grand-jar'];

const NUMBERED_SECTIONS = [
  ['01', 'Find Your Scent', 'Four compositions, one ritual. Pick the notes that feel like you — or wear a different one every day.'],
  ['02', 'Four Ingredients. Nothing Else.', 'Arrowroot, kaolin clay, rice bran, and mica. Talc-free and finely milled, so it glides on without weight or chalkiness.'],
  ['03', 'Pressed In, Not Sprayed On', 'A puff instead of an atomizer means no cloud, no overspray, no guessing how much is too much — and a finish that holds all day instead of fading by afternoon.'],
  ['04', 'One Jar, Every Day', 'Wear it alone, or press it over your usual perfume to extend it. Gentle enough for daily use, close enough to skin that only you really know it’s there.'],
];

const TRUST_BADGES = ['Talc-Free', 'Vegan & Cruelty-Free', '30-Day Returns', 'Ships in 1 Business Day'];

export default function Offer2Page() {
  const router = useRouter();
  const { applyDiscount, appliedDiscount } = useCart();
  const reviewsByProduct = useAllReviews();

  const [selectedId, setSelectedId] = React.useState('original');
  const [claiming, setClaiming] = React.useState(false);
  const [discountApplied, setDiscountApplied] = React.useState(false);

  const selectedProduct = getProductById(selectedId);

  React.useEffect(() => {
    if (appliedDiscount?.code === DISCOUNT_CODE) {
      setDiscountApplied(true);
      return;
    }
    applyDiscount(DISCOUNT_CODE).then((r) => setDiscountApplied(!!r?.valid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allReviews = React.useMemo(
    () => Object.values(reviewsByProduct).flatMap((r) => r.reviews || []),
    [reviewsByProduct]
  );
  const reviewCount = allReviews.length;
  const reviewAverage = reviewCount === 0 ? 0 : Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10;
  const recentReviews = React.useMemo(
    () => allReviews.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 4),
    [allReviews]
  );

  // Hands off to /offer3, the single-page order form (scent/quantity +
  // shipping + payment) — that page manages its own order state, so this
  // just carries the chosen scent along as a query param rather than
  // touching the shared cart.
  const handleClaim = () => {
    setClaiming(true);
    router.push({ pathname: '/offer3', query: { scent: selectedId } });
  };

  if (!selectedProduct) return null;

  return (
    <div style={{ background: T.white }}>
      <Head>
        <title>VEIL — Find Your Scent</title>
      </Head>

      {discountApplied && (
        <div style={{ background: T.ink, color: T.white, textAlign: 'center', padding: '10px 16px', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          Your 15% discount has been applied &mdash; code {DISCOUNT_CODE}
        </div>
      )}

      <header style={{ textAlign: 'center', padding: '24px 0', borderBottom: `1px solid ${T.line}` }}>
        <img src="/images/veil-logo-black.png" alt="VEIL" style={{ height: 22, width: 'auto' }} />
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
        {/* HERO */}
        <section className="o2-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center', padding: '48px 0 20px' }}>
          <div>
            <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(28px,4vw,40px)', lineHeight: 1.15, margin: 0 }}>
              Still Reaching for a Bottle That Fades by <span style={S.it}>2 PM</span>?
            </h1>
            <div style={{ marginTop: 24, display: 'grid', gap: 10 }}>
              {[
                ['Spray and reapply all day', 'One press, worn all day'],
                ['Announces itself across a room', 'Only noticed up close'],
                ['$150–300 a bottle', '$45 a jar'],
              ].map(([before, after]) => (
                <div key={before} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 14 }}>
                  <div style={{ color: T.soft, textDecoration: 'line-through' }}>&times; {before}</div>
                  <div style={{ color: T.ink, fontWeight: 500 }}>&#10003; {after}</div>
                </div>
              ))}
            </div>
            <button onClick={handleClaim} disabled={claiming} style={{ ...S.btnFill, marginTop: 28, height: 52, justifyContent: 'center', opacity: claiming ? 0.6 : 1 }}>
              {claiming ? 'Loading…' : 'Shop VEIL — 15% Off →'}
            </button>
          </div>
          <div style={{ aspectRatio: '4/5', overflow: 'hidden' }}>
            <ProductVisual id={selectedProduct.id} images={selectedProduct.images} alt={selectedProduct.name} width={480} />
          </div>
        </section>

        {/* TRUST STRIP */}
        <section style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px 28px', padding: '20px 0 40px', borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
          {TRUST_BADGES.map((b) => (
            <span key={b} style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft }}>{b}</span>
          ))}
        </section>

        {/* NUMBERED SECTIONS */}
        <section style={{ padding: '48px 0 20px' }}>
          {NUMBERED_SECTIONS.map(([n, h, p]) => (
            <div key={n} style={{ display: 'flex', gap: 24, alignItems: 'flex-start', padding: '24px 0', borderBottom: `1px solid ${T.line}` }}>
              <div style={{ fontFamily: T.serif, fontStyle: 'italic', fontWeight: 300, fontSize: 32, color: T.soft, flexShrink: 0, width: 48 }}>{n}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 21, margin: '0 0 8px' }}>{h}</h3>
                <p style={{ color: T.soft, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{p}</p>

                {n === '01' && (
                  <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14 }}>
                    {SCENT_IDS.map((id) => {
                      const prod = PRODUCTS.find((p2) => p2.id === id);
                      if (!prod) return null;
                      const active = id === selectedId;
                      return (
                        <button
                          key={id}
                          onClick={() => setSelectedId(id)}
                          style={{
                            textAlign: 'left', cursor: 'pointer', background: T.white,
                            border: `1px solid ${active ? T.ink : T.line}`, padding: '14px 14px 16px',
                            outline: active ? `1px solid ${T.ink}` : 'none', outlineOffset: -2,
                          }}
                        >
                          <div style={{ aspectRatio: '1/1', marginBottom: 10 }}>
                            <ProductVisual id={prod.id} images={prod.images} alt={prod.name} width={140} />
                          </div>
                          <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 400 }}>{prod.name}</div>
                          <div style={{ fontSize: 11, color: T.soft, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{prod.tagline}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>

        <div style={{ textAlign: 'center', margin: '36px 0' }}>
          <button onClick={handleClaim} disabled={claiming} style={{ ...S.btnFill, width: '100%', maxWidth: 420, justifyContent: 'center', height: 56, opacity: claiming ? 0.6 : 1 }}>
            {claiming ? 'Loading…' : `Shop ${selectedProduct.name} — 15% Off →`}
          </button>
        </div>

        {/* GUARANTEE */}
        <section style={{ padding: '20px 0', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 92, height: 92, borderRadius: '50%', border: `1px solid ${T.ink}`, marginBottom: 20 }}>
            <span style={{ fontFamily: T.serif, fontSize: 12, letterSpacing: '0.08em', textAlign: 'center', lineHeight: 1.3, padding: '0 10px' }}>30-Day<br />Guarantee</span>
          </div>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Try It Without the Risk</h2>
          <p style={{ color: T.soft, fontSize: 15, marginTop: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Every VEIL order is backed by a 30-day return policy on unopened, unused products — send it back for a full refund to your original payment method.
          </p>
        </section>

        {/* REVIEWS */}
        {reviewCount > 0 && (
          <section style={{ padding: '20px 0 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>What Real Customers Are Saying</h2>
              <div style={{ marginTop: 12, color: T.ink, letterSpacing: '3px', fontSize: 14 }}>{'★'.repeat(Math.round(reviewAverage))}{'☆'.repeat(5 - Math.round(reviewAverage))}</div>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.soft, marginTop: 6 }}>{reviewAverage.toFixed(1)} average · {reviewCount} review{reviewCount === 1 ? '' : 's'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: T.line }}>
              {recentReviews.map((r) => (
                <div key={r.id} style={{ background: T.white, padding: '22px 20px' }}>
                  <div style={{ color: T.ink, letterSpacing: '1.5px', fontSize: 12, marginBottom: 10 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                  <p style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 16, lineHeight: 1.4, margin: 0 }}>&ldquo;{r.text}&rdquo;</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 12 }}>
                    <cite style={{ fontStyle: 'normal', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft }}>{r.author}</cite>
                    {r.createdAt && (
                      <span style={{ fontSize: 10, color: T.soft }}>{new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* URGENCY CLOSE */}
        <section style={{ padding: '20px 0', fontSize: 17, lineHeight: 1.7 }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Two Ways This Goes.</h2>
          <p style={{ marginTop: 18 }}><b>Option one</b>: close this tab, and the next time you reach for perfume, you’re back to spraying, reapplying, and hoping it lasts past lunch.</p>
          <p><b>Option two</b>: claim your 15% off and find out what a jar that actually holds all day feels like — with 30 days to send it back if it’s not for you.</p>
        </section>

        <div style={{ textAlign: 'center', margin: '20px 0 60px' }}>
          <button onClick={handleClaim} disabled={claiming} style={{ ...S.btnFill, width: '100%', maxWidth: 420, justifyContent: 'center', height: 56, opacity: claiming ? 0.6 : 1 }}>
            {claiming ? 'Loading…' : `Shop ${selectedProduct.name} — $${selectedProduct.price} →`}
          </button>
          <p style={{ fontSize: 12, color: T.soft, marginTop: 14 }}>30-day returns · Vegan &amp; cruelty-free · Ships within 1 business day</p>
        </div>
      </main>

      <footer style={{ borderTop: `1px solid ${T.line}`, padding: '28px 24px', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft, marginBottom: 16 }}>
          <Link href="/terms">Terms &amp; Conditions</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/returns">Return Policy</Link>
          <Link href="/shipping">Shipping Policy</Link>
        </div>
        <p style={{ fontSize: 11, color: T.soft }}>&copy; {new Date().getFullYear()} VEIL. All rights reserved.</p>
      </footer>

      <style jsx>{`
        @media (max-width: 680px) {
          .o2-hero-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
