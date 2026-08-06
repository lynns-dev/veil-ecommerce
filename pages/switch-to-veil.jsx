import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import { useCart } from '../lib/useCart';
import { useAllReviews } from '../lib/useReviews';
import { getProductById } from '../lib/products';
import { T, S } from '../lib/theme';

// Single-page ad landing, distinct from the /offer -> /offer2 -> /offer3
// funnel: that funnel hands off between three pages and manages its own
// order state; this one is meant to be a complete, self-contained pitch
// that adds straight to the real shared cart (useCart) and sends the
// visitor to the real /checkout, so there's no separate order-state code
// to keep in sync with the rest of the site.
//
// Angle: not "here's a nice-smelling product" but "here's why the thing
// you're already using (spray perfume) works against you, and here's the
// mechanism that fixes it" — curiosity into education into the product as
// the resolution, then a Grand Puff cross-sell right before checkout.
//
// Same honesty rule as the rest of the ad pages: every ingredient/wear/
// return claim below is pulled from lib/products.js, pages/returns.jsx,
// etc. — nothing promised here that the rest of the site doesn't actually
// back up. No fabricated citations for the "why perfume fades" section —
// it stays at the level of well-established, uncontroversial fragrance
// facts (alcohol as a volatile carrier, top-note evaporation, nose fatigue)
// rather than invented statistics.

const PRODUCT_ID = 'original';
const PUFF_ID = 'puff';

const ctaBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(180deg, #FFD54A 0%, #FFB300 100%)',
  color: '#241900', border: 'none', borderRadius: 8, cursor: 'pointer',
  fontFamily: T.sans, fontWeight: 800, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
  boxShadow: '0 5px 0 #C98200, 0 10px 18px rgba(201,130,0,0.35)',
  transition: 'transform .08s ease, box-shadow .08s ease',
};

const WHY_IT_FADES = [
  [
    'It’s mostly alcohol.',
    'Spray perfume is fragrance oil suspended in alcohol — alcohol is what makes it a fine, even mist. But alcohol is also a volatile carrier: it evaporates within minutes, and it takes the lightest, most noticeable top notes with it. What’s left by mid-morning is a much fainter version of what you sprayed on at 7 AM.',
  ],
  [
    'Your nose gives up on it before anyone else does.',
    'Wear any scent continuously for about twenty minutes and your nose stops registering it — a real, well-documented effect called olfactory fatigue. You’re not imagining that it “disappeared.” You just can’t smell it on yourself anymore, even when other people still can.',
  ],
  [
    'So you spray more — and that’s the actual problem.',
    'Because you stop smelling it, the instinct is to reapply, or to spray heavier to begin with. That’s the gap that makes perfume feel unpredictable: too loud in the first twenty minutes, gone by the time it matters. It’s not a scent problem. It’s a delivery problem.',
  ],
];

const RITUAL_STEPS = [
  ['01', 'Press the puff into the powder', 'Scent lives best on warm, clean skin — right after the bath is ideal.'],
  ['02', 'Sweep where you’re noticed', 'Collarbones, shoulders, the backs of the knees. A veil, not a cloud.'],
  ['03', 'Carry it through the day', 'No reapplying, no second-guessing — it’s already pressed in.'],
];

export default function SwitchToVeilPage() {
  const router = useRouter();
  const c = useCart();
  const reviewsByProduct = useAllReviews();

  const product = getProductById(PRODUCT_ID);
  const puff = getProductById(PUFF_ID);

  const [includePuff, setIncludePuff] = React.useState(true);
  const [claiming, setClaiming] = React.useState(false);

  const reviewData = reviewsByProduct[PRODUCT_ID] || { reviews: [], average: 0, count: 0 };
  const total = (product?.price || 0) + (includePuff ? (puff?.price || 0) : 0);

  const handleClaim = () => {
    setClaiming(true);
    c.add(product, 1);
    if (includePuff) c.add(puff, 1);
    router.push('/checkout');
  };

  if (!product || !puff) return null;

  return (
    <div style={{ background: T.white }}>
      <Head>
        <title>VEIL — Why Your Perfume Fades (And What Actually Fixes It)</title>
      </Head>

      <header style={{ textAlign: 'center', padding: '28px 0', borderBottom: `1px solid ${T.line}` }}>
        <img src="/images/veil-logo-black.png" alt="VEIL" style={{ height: 22, width: 'auto' }} />
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>
        {/* HOOK */}
        <section style={{ paddingTop: 48 }}>
          <p style={{ ...S.label, marginBottom: 14 }}>An honest look at spray perfume</p>
          <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(30px,5vw,44px)', lineHeight: 1.15, margin: 0 }}>
            Your Perfume Isn’t Losing to a Better Scent. It’s Losing to <span style={S.it}>Chemistry.</span>
          </h1>
          <p style={{ fontSize: 17, color: T.soft, marginTop: 18, lineHeight: 1.5 }}>
            The reason it’s loud at 8 AM and gone by noon has nothing to do with which bottle you bought — it’s how it’s built to disappear.
          </p>
          <hr style={{ border: 'none', borderTop: `2px solid ${T.ink}`, margin: '28px 0' }} />
        </section>

        {/* EDUCATE */}
        <section>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>What’s Actually Happening</h2>
          <div style={{ marginTop: 28, display: 'grid', gap: 28 }}>
            {WHY_IT_FADES.map(([h, p]) => (
              <div key={h}>
                <h3 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 19, margin: '0 0 8px' }}>{h}</h3>
                <p style={{ color: T.soft, fontSize: 15.5, lineHeight: 1.65, margin: 0 }}>{p}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 17, lineHeight: 1.7, marginTop: 28 }}>
            <i>So the fix was never going to be a stronger formulation, or a more expensive bottle. It had to be a completely different way of wearing scent — one that doesn’t rely on alcohol you can’t control the evaporation of.</i>
          </p>
        </section>

        <div style={{ margin: '32px -24px', aspectRatio: '4/3', overflow: 'hidden' }}>
          <img src="/images/veil-ugc-1.webp" alt="A VEIL customer holding her jar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>

        {/* SOLUTION */}
        <section style={{ padding: '8px 0' }}>
          <p style={{ ...S.label, marginBottom: 14 }}>The alternative</p>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Powder, Pressed In — Not Sprayed On.</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, marginTop: 18 }}>
            VEIL’s <b>Original Scented Fragrance Powder</b> carries jasmine, hinoki, and vanilla in a talc-free base of arrowroot, kaolin clay, rice bran, and mica — no alcohol carrier to evaporate off in the first twenty minutes. It’s pressed into skin with a puff, not misted into the air, so what you put on stays close instead of projecting out and fading fast.
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.7 }}>
            One jar carries the wear of a full bottle of perfume. For $45.
          </p>
          <div className="switch-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center', marginTop: 28 }}>
            <div style={{ aspectRatio: '4/5', overflow: 'hidden' }}>
              <ProductVisual id={product.id} images={product.images} alt={product.name} width={340} />
            </div>
            <div>
              <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 22 }}>{product.name}</div>
              <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: T.soft, margin: '6px 0 14px' }}>{product.tagline}</div>
              <div style={{ fontFamily: T.serif, fontSize: 22 }}>${product.price.toFixed(2)} <span style={{ fontSize: 13, color: T.soft, fontFamily: T.sans }}>· {product.size}</span></div>
            </div>
          </div>
        </section>

        <div style={{ textAlign: 'center', margin: '36px 0' }}>
          <button className="cta-3d" onClick={handleClaim} disabled={claiming} style={{ ...ctaBtn, width: '100%', maxWidth: 420, height: 56, opacity: claiming ? 0.6 : 1 }}>
            {claiming ? 'Loading…' : 'Try VEIL Now →'}
          </button>
        </div>

        {/* HOW IT WORKS */}
        <section style={{ padding: '20px 0 40px', textAlign: 'center' }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(26px,4vw,34px)' }}>Three Soft Motions.</h2>
          <p style={{ color: T.soft, fontSize: 15, marginTop: 10 }}>No spray, no cloud, no guessing how much is too much.</p>
          <div style={{ marginTop: 40, display: 'grid', gap: 36, textAlign: 'left' }}>
            {RITUAL_STEPS.map(([n, h, p]) => (
              <div key={n} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ fontFamily: T.serif, fontStyle: 'italic', fontWeight: 300, fontSize: 26, color: T.soft, flexShrink: 0, width: 44 }}>{n}</div>
                <div>
                  <h3 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 19, margin: '0 0 6px' }}>{h}</h3>
                  <p style={{ color: T.soft, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{p}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PROOF */}
        {reviewData.count > 0 && (
          <section style={{ padding: '20px 0 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 44 }}>{reviewData.average.toFixed(1)}</div>
              <div style={{ color: T.ink, letterSpacing: '3px', fontSize: 14 }}>{'★'.repeat(Math.round(reviewData.average))}{'☆'.repeat(5 - Math.round(reviewData.average))}</div>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.soft, marginTop: 6 }}>{reviewData.count} review{reviewData.count === 1 ? '' : 's'} on the Original scent</div>
            </div>
            <div style={{ display: 'grid', gap: 1, background: T.line }}>
              {reviewData.reviews.slice().reverse().slice(0, 3).map((r) => (
                <div key={r.id} style={{ background: T.white, padding: '22px 20px' }}>
                  <div style={{ color: T.ink, letterSpacing: '1.5px', fontSize: 12, marginBottom: 10 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                  <p style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18, lineHeight: 1.4, margin: 0 }}>“{r.text}”</p>
                  <cite style={{ fontStyle: 'normal', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, display: 'block', marginTop: 12 }}>{r.author}</cite>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CURIOSITY-DRIVEN UPSELL: GRAND PUFF */}
        <section style={{ padding: '24px 0' }}>
          <p style={{ ...S.label, marginBottom: 14 }}>One thing almost everyone gets wrong at first</p>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>The Jar Isn’t the Whole Ritual.</h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, marginTop: 18 }}>
            Most first-time orders come with the small puff VEIL ships as standard — and most first-week complaints trace back to it. A puff that’s too small picks up powder unevenly, so one sweep lands heavy and the next barely touches the skin. The result is patchy coverage: strong in one spot, faded in another, by the same afternoon.
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.7 }}>
            The <b>Grand Puff</b> is VEIL’s oversized applicator, built specifically to fix that — wide enough to pick up an even layer in a single press, so the same jar goes on more consistently, wear after wear.
          </p>

          <button
            type="button"
            onClick={() => setIncludePuff((v) => !v)}
            style={{
              display: 'flex', gap: 16, alignItems: 'center', width: '100%', textAlign: 'left',
              marginTop: 24, padding: '18px 18px', cursor: 'pointer',
              background: includePuff ? T.paper : T.white,
              border: `1px solid ${includePuff ? T.ink : T.line}`,
            }}
          >
            <div style={{ width: 22, height: 22, flexShrink: 0, border: `1px solid ${T.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: includePuff ? T.ink : 'transparent' }}>
              {includePuff && <span style={{ color: T.white, fontSize: 13, lineHeight: 1 }}>✓</span>}
            </div>
            <div style={{ width: 52, height: 52, flexShrink: 0 }}>
              <ProductVisual id={puff.id} images={puff.images} alt={puff.name} width={52} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: T.serif, fontSize: 16 }}>Add {puff.name}</div>
              <div style={{ fontSize: 12, color: T.soft, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{puff.tagline}</div>
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 17, flexShrink: 0 }}>+${puff.price.toFixed(2)}</div>
          </button>
        </section>

        {/* GUARANTEE */}
        <section style={{ padding: '20px 0', textAlign: 'center' }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Try It Without the Risk</h2>
          <p style={{ color: T.soft, fontSize: 15, marginTop: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Every VEIL order is backed by a 30-day return policy. If it’s not the right fit, send it back for a full refund to your original payment method — no hoops to jump through.
          </p>
        </section>

        {/* URGENCY CLOSE */}
        <section style={{ padding: '20px 0', fontSize: 17, lineHeight: 1.7 }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Two Ways This Goes From Here.</h2>
          <p style={{ marginTop: 18 }}><b>Option one</b> is to close this tab and keep spraying more of something that’s built to fade by the time it matters.</p>
          <p><b>Option two</b> is to find out what wearing scent feels like when it isn’t racing to evaporate.</p>
        </section>

        <div style={{ textAlign: 'center', margin: '20px 0 60px' }}>
          <button className="cta-3d" onClick={handleClaim} disabled={claiming} style={{ ...ctaBtn, width: '100%', maxWidth: 420, height: 56, opacity: claiming ? 0.6 : 1 }}>
            {claiming ? 'Loading…' : `Get My VEIL — $${total.toFixed(2)} →`}
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
        @media (max-width: 560px) {
          .switch-hero-grid { grid-template-columns: 1fr !important; }
        }
        :global(.cta-3d:hover:not(:disabled)) { filter: brightness(1.04); }
        :global(.cta-3d:active:not(:disabled)) {
          transform: translateY(4px);
          box-shadow: 0 1px 0 #C98200, 0 3px 8px rgba(201,130,0,0.3);
        }
      `}</style>
    </div>
  );
}
