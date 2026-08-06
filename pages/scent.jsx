import React from 'react';
import Link from 'next/link';
import Seo from '../components/Seo';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import ProductVisual from '../components/ProductVisual';
import PaymentMethods from '../components/PaymentMethods';
import Marquee from '../components/Marquee';
import Footer from '../components/Footer';
import { getProductById } from '../lib/products';
import { useCart } from '../lib/useCart';
import { useAllReviews } from '../lib/useReviews';
import { fbTrack } from '../lib/fbPixel';
import { T, S } from '../lib/theme';

// A product-page-style landing page, unlike /offer and /switch-to-veil
// (both deliberately chrome-free advertorials with a single hand-off CTA).
// This one keeps the real site chrome (Header, CartDrawer, Marquee,
// Footer) and PDP-style layout/gallery/sticky-bar, but leans much harder
// into the fragrance notes than the standard product page does (there
// they're one collapsed accordion among several; here they're the
// centerpiece), and carries its own special offer.
//
// The offer is a real, page-specific discount code (SCENT15), auto-applied
// via the same applyDiscount() mechanism /offer2 uses for VEIL15 — not a
// static "was/now" price shown on the page itself. That mirrors the
// /offer2 pattern deliberately: after this site's sitewide 10% auto-
// discount was removed (it silently discounted every visitor, not just
// people who came for this specific promo), the honest way to show a real
// discount is to actually apply it to the cart and let checkout display
// the true number, not compute a preview price on the page that could
// drift from what's actually charged.
//
// SCENT15 needs to exist in the live discount store before this goes out
// — add it from /admin's Discounts tab (15% off) the same way VEIL15
// needed to be added for the /offer funnel; it isn't auto-seeded.

const PRODUCT_ID = 'original';
const DISCOUNT_CODE = 'SCENT15';

const HOW_TO_USE = [
  ['After the bath', 'Press the puff into the powder. Scent lives best on warm, clean skin.'],
  ['Sweep where you’re noticed', 'Collarbones, shoulders, the backs of the knees. A veil, not a coat.'],
  ['Carry it through the day', 'Wear alone, or layer over perfume to extend it.'],
];

export default function ScentOfferPage() {
  const c = useCart();
  const product = getProductById(PRODUCT_ID);
  const reviewsByProduct = useAllReviews();
  const reviewData = reviewsByProduct[PRODUCT_ID] || { reviews: [], average: 0, count: 0 };

  const [quantity, setQuantity] = React.useState(1);
  const [discountApplied, setDiscountApplied] = React.useState(false);
  const [activeImage, setActiveImage] = React.useState(product?.images?.[0]);

  React.useEffect(() => {
    if (c.appliedDiscount?.code === DISCOUNT_CODE) {
      setDiscountApplied(true);
      return;
    }
    c.applyDiscount(DISCOUNT_CODE).then((r) => setDiscountApplied(!!r?.valid));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!product) return;
    fbTrack('ViewContent', {
      content_ids: [product.id],
      content_name: product.name,
      content_type: 'product',
      value: product.price,
      currency: 'USD',
    });
  }, [product]);

  if (!product) return null;

  const handleAdd = () => {
    c.add(product, quantity);
    setQuantity(1);
  };

  return (
    <div style={{ paddingBottom: 76 }}>
      <Seo
        title={`${product.name} — Special Offer`}
        description={`${product.description} 15% off with code ${DISCOUNT_CODE}.`}
        image={product.images[0]}
        path="/scent"
      />
      <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} />

      {discountApplied && (
        <div style={offerStrip}>
          Your 15% discount has been applied &mdash; code {DISCOUNT_CODE}
        </div>
      )}

      {/* HERO */}
      <section style={{ maxWidth: T.maxw, margin: '0 auto', padding: '40px 40px 60px' }}>
        <div className="scent-grid" style={grid}>
          <div className="scent-gallery" style={gallery}>
            <div style={imgSide}>
              {product.badge && <span style={imageBadge}>{product.badge}</span>}
              <img src={activeImage} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            {product.images.length > 1 && (
              <div className="thumb-row" style={thumbRow}>
                {product.images.map((src) => (
                  <button
                    key={src}
                    onClick={() => setActiveImage(src)}
                    style={{ ...thumbBtn, borderColor: activeImage === src ? T.ink : T.line }}
                    aria-label="Show image"
                    aria-current={activeImage === src}
                  >
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={infoCol}>
            <p style={{ ...S.label, marginBottom: 14 }}>Special offer — 15% off, code {DISCOUNT_CODE}</p>
            <a href="#reviews" style={pdpRating}>
              {reviewData.count > 0 ? (
                <>
                  <span style={{ color: T.ink, letterSpacing: '2px' }}>{'★'.repeat(Math.round(reviewData.average))}{'☆'.repeat(5 - Math.round(reviewData.average))}</span>
                  {' '}{reviewData.average.toFixed(1)} · {reviewData.count} review{reviewData.count === 1 ? '' : 's'}
                </>
              ) : (
                'Be the first to review'
              )}
            </a>
            <h1 style={pdpTitle}>{product.name}</h1>
            <div style={pdpTagline}>{product.tagline}</div>
            <p style={pdpDesc}>{product.description}</p>
            <div style={pdpPrice}>${product.price.toFixed(2)} <span style={{ fontSize: 14, color: T.soft }}>· {product.size}</span></div>

            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 20 }}>
              <div style={qtyWrap}>
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} style={qtyBtn} aria-label="Decrease quantity">−</button>
                <span style={qtyValue}>{quantity}</span>
                <button onClick={() => setQuantity((q) => q + 1)} style={qtyBtn} aria-label="Increase quantity">+</button>
              </div>
              <button style={{ ...S.btnFill, flex: 1, justifyContent: 'center' }} onClick={handleAdd}>Add to bag — 15% off applies at checkout</button>
            </div>

            <PaymentMethods />
            <div style={badgeRow}>Ships in 2–4 days · Vegan-friendly · Cruelty-free</div>
            <p style={puffIncludedNote}>Comes with the Veil Luxury Puff for effortless, everyday application.</p>
          </div>
        </div>
      </section>

      {/* SCENT STORY — the centerpiece, not an accordion */}
      {product.notes && (
        <section style={{ ...narrowBand, background: T.paper, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
          <div style={{ ...narrowWrap, textAlign: 'center' }}>
            <p style={S.label}>The scent story</p>
            <h2 style={{ ...S.h2, marginTop: 12, fontSize: 'clamp(28px,3.4vw,40px)' }}>
              Three Layers, <span style={S.it}>One Veil.</span>
            </h2>
            <p style={{ color: T.soft, fontSize: 15, marginTop: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
              A fragrance told in three acts — what you notice first, what settles in, and what stays.
            </p>
            <div className="notes-grid" style={notesGrid}>
              {[
                ['The Opening', 'top', product.notes.top],
                ['The Heart', 'middle', product.notes.middle],
                ['The Base', 'base', product.notes.base],
              ].map(([label, key, value]) => (
                <div key={key} style={noteCard}>
                  <p style={S.label}>{label}</p>
                  <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
                    {value.split('·').map((item, i) => (
                      <div key={i} style={noteWord}>{item.trim()}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* NARRATIVE — dark pull quote */}
      <section style={{ ...narrowBand, background: T.ink }}>
        <div style={narrowWrap}>
          <p style={{ ...S.label, color: 'rgba(252,251,247,0.6)' }}>The scent, in full</p>
          <p style={{ ...narrative, color: T.white }}>{product.longDescription}</p>
        </div>
      </section>

      {/* HOW TO USE */}
      <section style={{ ...narrowBand, textAlign: 'center' }}>
        <div style={narrowWrap}>
          <p style={S.label}>The ritual</p>
          <h2 style={{ ...S.h2, marginTop: 12, fontSize: 'clamp(26px,3.4vw,36px)' }}>Three Soft Motions.</h2>
          <div style={{ marginTop: 40, display: 'grid', gap: 36, textAlign: 'left' }}>
            {HOW_TO_USE.map(([h, p], i) => (
              <div key={i} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ fontFamily: T.serif, fontStyle: 'italic', fontWeight: 300, fontSize: 26, color: T.soft, flexShrink: 0, width: 44 }}>{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <h3 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 19, margin: '0 0 6px' }}>{h}</h3>
                  <p style={{ color: T.soft, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" style={{ ...narrowBand, borderTop: `1px solid ${T.line}` }}>
        <div style={{ ...narrowWrap, textAlign: 'center' }}>
          <p style={S.label}>The verdict</p>
          <h2 style={{ ...S.h2, marginTop: 12, fontSize: 'clamp(26px,3vw,36px)' }}>Worn close, <span style={S.it}>adored quietly.</span></h2>
          {reviewData.count > 0 ? (
            <div style={{ marginTop: 30, display: 'grid', gap: 1, background: T.line, textAlign: 'left' }}>
              {reviewData.reviews.slice().reverse().slice(0, 4).map((r) => (
                <div key={r.id} style={{ background: T.white, padding: '22px 20px' }}>
                  <div style={{ color: T.ink, letterSpacing: '1.5px', fontSize: 12, marginBottom: 10 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                  <p style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18, lineHeight: 1.4, margin: 0 }}>“{r.text}”</p>
                  <cite style={{ fontStyle: 'normal', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, display: 'block', marginTop: 12 }}>{r.author}</cite>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: T.soft, fontSize: 14, padding: '20px 0' }}>No reviews yet — be the first.</p>
          )}
        </div>
      </section>

      {/* OFFER REMINDER + GUARANTEE */}
      <section style={{ ...narrowBand, textAlign: 'center', borderTop: `1px solid ${T.line}` }}>
        <div style={narrowWrap}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Try It Without the Risk</h2>
          <p style={{ color: T.soft, fontSize: 15, marginTop: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            15% off is already applied to your cart with code {DISCOUNT_CODE}. Every VEIL order is also backed by a 30-day return policy — if it’s not the right fit, send it back for a full refund to your original payment method.
          </p>
          <button style={{ ...S.btnFill, marginTop: 24 }} onClick={handleAdd}>Add to bag — ${product.price.toFixed(2)}</button>
        </div>
      </section>

      <Marquee />
      <Footer />

      <CartDrawer {...c} onClose={() => c.setOpen(false)} />

      {/* Floating add-to-cart bar */}
      <div style={stickyBar}>
        <div className="sticky-bar-inner" style={stickyBarInner}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18, color: T.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</div>
            <div style={{ fontSize: 13, color: 'rgba(252,251,247,0.7)', marginTop: 2 }}>${product.price.toFixed(2)} · 15% off with code {DISCOUNT_CODE}</div>
          </div>
          <div className="sticky-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div style={stickyQtyWrap}>
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} style={stickyQtyBtn} aria-label="Decrease quantity">−</button>
              <span style={{ ...qtyValue, color: T.white }}>{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} style={stickyQtyBtn} aria-label="Increase quantity">+</button>
            </div>
            <button onClick={handleAdd} style={stickyAddBtn}>Add to bag</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .scent-grid { grid-template-columns: 1fr 1fr; }
        .notes-grid { grid-template-columns: repeat(3, 1fr); }
        .thumb-row { flex-direction: row; }
        .sticky-bar-inner { padding: 0 40px; }
        @media (max-width: 680px) {
          .scent-grid { grid-template-columns: 1fr; gap: 24px; }
          .notes-grid { grid-template-columns: 1fr; gap: 1px; }
          .sticky-bar-inner { padding: 0 16px; gap: 12px; }
          .sticky-bar-actions { gap: 10px; }
        }
      `}</style>
    </div>
  );
}

const offerStrip = {
  textAlign: 'center', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase',
  color: T.white, background: T.ink, padding: '10px 16px',
};

const grid = { display: 'grid', gap: 60, alignItems: 'start' };
const gallery = { display: 'flex', flexDirection: 'column', gap: 14 };
const imgSide = { position: 'relative', background: T.paper, aspectRatio: '4/5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.line}`, overflow: 'hidden' };
const imageBadge = {
  position: 'absolute', top: 14, right: 14, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase',
  color: T.ink, background: 'rgba(252,251,247,0.92)', padding: '6px 10px', zIndex: 1, fontFamily: T.sans,
};
const thumbRow = { display: 'flex', gap: 10 };
const thumbBtn = { width: 64, height: 64, padding: 0, border: '1px solid', cursor: 'pointer', overflow: 'hidden', background: 'none', flexShrink: 0 };
const infoCol = { position: 'sticky', top: 110 };
const pdpRating = {
  display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: T.soft,
  fontFamily: T.sans, width: 'fit-content', borderBottom: `1px solid ${T.line}`, paddingBottom: 2, marginBottom: 14,
};
const pdpTitle = { fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(28px,3.6vw,42px)', lineHeight: 1.05, marginBottom: 10 };
const pdpTagline = { fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, marginBottom: 14 };
const pdpDesc = { fontSize: 15, color: '#4a453c', maxWidth: '46ch', lineHeight: 1.6, marginBottom: 22 };
const pdpPrice = { fontFamily: T.serif, fontWeight: 300, fontSize: 28, marginBottom: 22 };
const qtyWrap = { display: 'flex', alignItems: 'center', border: `1px solid ${T.line}`, height: 48 };
const qtyBtn = { width: 40, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, color: T.ink };
const qtyValue = { width: 30, textAlign: 'center', fontSize: 13 };
const badgeRow = { fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: T.soft, marginTop: 4 };
const puffIncludedNote = { fontSize: 13, color: T.soft, marginTop: 10 };

const narrowBand = { padding: '56px 0' };
const narrowWrap = { maxWidth: 720, margin: '0 auto', padding: '0 40px' };
const narrative = { fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(20px,2.4vw,26px)', lineHeight: 1.5, marginTop: 16 };

const notesGrid = { display: 'grid', marginTop: 40, gap: 1, background: T.line, border: `1px solid ${T.line}` };
const noteCard = { background: T.white, padding: '30px 24px' };
const noteWord = { fontFamily: T.serif, fontWeight: 300, fontSize: 18, color: T.ink };

const stickyBar = {
  position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 150,
  background: T.ink, borderTop: `1px solid ${T.ink}`, boxShadow: '0 -1px 0 rgba(0,0,0,0.6)',
  padding: '14px 0',
};
const stickyBarInner = {
  maxWidth: T.maxw, margin: '0 auto',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
};
const stickyQtyWrap = { display: 'flex', alignItems: 'center', border: `1px solid ${T.dline}`, height: 40 };
const stickyQtyBtn = { width: 32, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: T.white };
const stickyAddBtn = {
  ...S.btnFill, background: T.white, color: T.ink, height: 40, padding: '0 22px',
  whiteSpace: 'nowrap', flexShrink: 0,
};
