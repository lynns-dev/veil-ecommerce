import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProductVisual from '../components/ProductVisual';
import { useAllReviews } from '../lib/useReviews';
import { getProductById } from '../lib/products';
import { T, S } from '../lib/theme';

// Long-form advertorial landing page — a single-product funnel meant to be
// linked directly from ads, not from the site's own nav (no Header/
// CartDrawer chrome, no cross-shop links). Structure follows a standard
// direct-response advertorial pattern (hook → story → proof → numbered
// benefits → how-it-works → deeper review → guarantee → urgency close),
// dressed in VEIL's own type/color system rather than a generic template
// look. Every claim on this page is pulled from real copy/policy already
// live elsewhere on the site (lib/products.js, pages/index.jsx, pages/
// returns.jsx) — nothing here should promise something the rest of the
// site doesn't actually back up.
//
// This is step one of a two-page funnel: every CTA here hands off to
// /offer2 (a hero/benefits/guarantee/reviews landing page) rather than
// straight to /checkout — /offer2 owns the actual add-to-cart, discount
// application, and scent selection.
//
// Reviews are pulled from the same live /api/reviews data every other page
// uses, not hardcoded — if there are no real reviews yet, that section
// just doesn't render rather than showing placeholder names, since
// fabricated testimonials on a page meant to persuade real buyers is a
// different (and worse) thing than a TODO comment in dev docs.

const PRODUCT_ID = 'original';
const DISCOUNT_CODE = 'VEIL15';

// Bright, raised "3D" CTA — a deliberate departure from the site's flat
// black/white buttons elsewhere, since this is a conversion-funnel page
// where the buy button should be the loudest thing on screen.
const ctaBtn = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  background: 'linear-gradient(180deg, #FFD54A 0%, #FFB300 100%)',
  color: '#241900', border: 'none', borderRadius: 8, cursor: 'pointer',
  fontFamily: T.sans, fontWeight: 800, fontSize: 12, letterSpacing: '0.16em', textTransform: 'uppercase',
  boxShadow: '0 5px 0 #C98200, 0 10px 18px rgba(201,130,0,0.35)',
  transition: 'transform .08s ease, box-shadow .08s ease',
};

const RITUAL_STEPS = [
  ['01', 'Press the puff into the powder', 'Scent lives best on warm, clean skin — right after the bath is ideal.'],
  ['02', 'Sweep where you’re noticed', 'Collarbones, shoulders, the backs of the knees. A veil, not a coat.'],
  ['03', 'Carry it through the day', 'Wear alone, or layer over perfume to extend it.'],
];

// Same reel of lifestyle clips already used on the product page's "Real
// women, smelling incredible" section (pages/product/[id].jsx) — reused
// here rather than re-shot, so the funnel stays visually consistent with
// the rest of the site.
const REEL_VIDEOS = [
  '/videos/A_woman_in_her_early_40s_in_a__Seedance_20_58180.mp4',
  '/videos/veil-ugc-video-1.mp4',
  '/videos/veil-ugc-video-2.mp4',
];

const REASONS = [
  ['01', 'The wear of a full bottle', 'One jar carries the wear of a full perfume bottle — for a fraction of the $150–300 luxury perfume costs.'],
  ['02', 'Intimate, close-to-skin', 'Noticed only by those who lean in close — never announces itself across a room.'],
  ['03', 'Talc-free, finely milled', 'Arrowroot, kaolin clay, rice bran and mica. Nothing else. Glides on without weight.'],
  ['04', 'Pressed in, not sprayed on', 'Holds all day with a soft-focus finish instead of fading by afternoon.'],
  ['05', 'A tactile ritual', 'Applied with a satin-ribbon puff, not a spray — slower, softer, more deliberate.'],
];

export default function OfferPage() {
  const router = useRouter();
  const product = getProductById(PRODUCT_ID);
  const reviewsByProduct = useAllReviews();

  const allReviews = React.useMemo(
    () => Object.values(reviewsByProduct).flatMap((r) => r.reviews || []),
    [reviewsByProduct]
  );
  const reviewCount = allReviews.length;
  const reviewAverage = reviewCount === 0 ? 0 : Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10;

  const [claiming, setClaiming] = React.useState(false);

  // Hands off to /offer2, which owns the actual add-to-cart + discount
  // application (and lets the visitor pick a scent) before checkout — this
  // page's job is just the story that gets someone to keep reading.
  const handleClaim = () => {
    setClaiming(true);
    router.push('/offer2');
  };

  if (!product) return null;

  return (
    <div style={{ background: T.white }}>
      <Head>
        <title>VEIL — The Fragrance Ritual That Takes 10 Seconds</title>
      </Head>

      <header style={{ textAlign: 'center', padding: '28px 0', borderBottom: `1px solid ${T.line}` }}>
        <img src="/images/veil-logo-black.png" alt="VEIL" style={{ height: 22, width: 'auto' }} />
      </header>

      <main style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>
        {/* HOOK */}
        <section style={{ paddingTop: 48 }}>
          <h1 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(30px,5vw,44px)', lineHeight: 1.15, margin: 0 }}>
            The 10-Second Ritual That Makes You Feel <span style={S.it}>Finished</span> Before You’ve Even Left the Room.
          </h1>
          <p style={{ fontSize: 17, color: T.soft, marginTop: 18, lineHeight: 1.5 }}>
            Discover why women are trading $200 perfume bottles for one $45 jar of VEIL.
          </p>
          <hr style={{ border: 'none', borderTop: `2px solid ${T.ink}`, margin: '28px 0' }} />
        </section>

        {/* STORY */}
        <section style={{ fontSize: 17, lineHeight: 1.7, color: T.ink }}>
          <p>I used to own four bottles of perfume. Two I loved, two I bought on a whim and never finished.</p>
          <p>The ones I loved were $180 and up. I’d spray once in the morning and by 2 PM, nothing — gone, like it never happened. And on the days I did remember to reapply, I’d walk into a room and it would arrive before I did.</p>
          <p>I wasn’t looking for <i>more</i> scent. I wanted something quieter — close to my skin, not across the room. Something that held on without me thinking about it.</p>
          <p>So when I heard about <b>VEIL</b>, a scented body powder that promises the wear of a full perfume bottle from a single jar — pressed in with a puff instead of sprayed — I was skeptical. I’d tried powders before. They faded faster than perfume, if they had any scent at all.</p>
          <p><i>Here’s what I found instead…</i></p>
        </section>

        <div style={{ margin: '32px -24px', aspectRatio: '4/3', overflow: 'hidden' }}>
          <img src="/images/veil-ugc-1.webp" alt="A VEIL customer holding her jar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>

        <div style={{ textAlign: 'center', margin: '36px 0' }}>
          <button className="cta-3d" onClick={handleClaim} disabled={claiming} style={{ ...ctaBtn, width: '100%', maxWidth: 420, height: 56, opacity: claiming ? 0.6 : 1 }}>
            {claiming ? 'Loading…' : `Try VEIL Now — 15% off with code ${DISCOUNT_CODE}`}
          </button>
        </div>

        {/* UGC — real customer photos, no invented names or quotes pinned
            to a specific face. */}
        <section style={{ padding: '8px 0 44px' }}>
          <p style={{ ...S.label, textAlign: 'center', marginBottom: 16 }}>Real women, real Veil</p>
          <div className="ugc-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 3, margin: '0 -24px' }}>
            {['/images/veil-ugc-2.webp', '/images/veil-ugc-3.webp'].map((src) => (
              <div key={src} style={{ aspectRatio: '4/5', overflow: 'hidden' }}>
                <img src={src} alt="A VEIL customer holding her jar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ))}
          </div>
        </section>

        {/* REEL — same lifestyle clips as the product page's video reel. */}
        <section style={{ padding: '8px 0 44px' }}>
          <div className="offer-reel-track" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 6, margin: '0 -24px', padding: '0 24px 6px' }}>
            {REEL_VIDEOS.map((src) => (
              <video
                key={src}
                className="offer-reel-item"
                style={{ aspectRatio: '9/16', objectFit: 'cover', background: T.paper, border: `1px solid ${T.line}`, minWidth: 0, borderRadius: 10, flex: '0 0 62%' }}
                src={src}
                muted
                loop
                playsInline
                autoPlay
                controls
              />
            ))}
          </div>
        </section>

        {/* PROOF */}
        {reviewCount > 0 && (
          <section style={{ padding: '20px 0 40px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 44 }}>{reviewAverage.toFixed(1)}</div>
              <div style={{ color: T.ink, letterSpacing: '3px', fontSize: 14 }}>{'★'.repeat(Math.round(reviewAverage))}{'☆'.repeat(5 - Math.round(reviewAverage))}</div>
              <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.soft, marginTop: 6 }}>{reviewCount} review{reviewCount === 1 ? '' : 's'}</div>
            </div>
            <div style={{ display: 'grid', gap: 1, background: T.line }}>
              {allReviews.slice().reverse().slice(0, 3).map((r) => (
                <div key={r.id} style={{ background: T.white, padding: '22px 20px' }}>
                  <div style={{ color: T.ink, letterSpacing: '1.5px', fontSize: 12, marginBottom: 10 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                  <p style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 18, lineHeight: 1.4, margin: 0 }}>“{r.text}”</p>
                  <cite style={{ fontStyle: 'normal', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, display: 'block', marginTop: 12 }}>{r.author}</cite>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* NUMBERED BENEFITS */}
        <section style={{ padding: '20px 0' }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(26px,4vw,34px)', textAlign: 'center' }}>
            5 Reasons Women Are Switching to <span style={S.it}>VEIL</span>
          </h2>
          <div style={{ marginTop: 40, display: 'grid', gap: 34 }}>
            {REASONS.map(([n, h, p]) => (
              <div key={n} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{ fontFamily: T.serif, fontStyle: 'italic', fontWeight: 300, fontSize: 30, color: T.soft, flexShrink: 0, width: 44 }}>{n}</div>
                <div>
                  <h3 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 20, margin: '0 0 6px' }}>{h}</h3>
                  <p style={{ color: T.soft, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{p}</p>
                </div>
              </div>
            ))}
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

        {/* DEEPER REVIEW / HONEST MATH */}
        <section style={{ padding: '20px 0', fontSize: 17, lineHeight: 1.7 }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Putting It To The Test</h2>
          <p style={{ marginTop: 18 }}>The first thing I noticed was how little I needed. One press of the puff, swept across my collarbones, and that was it — done in the time it takes to towel off.</p>
          <p>By evening, it was still there. Not loud — I had to lean in to smell it on myself, which is exactly the point. It held through a full day without a single reapplication.</p>
          <p><b>The math is what actually sold me.</b> A bottle of the perfume I used to buy ran $150–300 and faded by afternoon. One $45 jar of VEIL carries the wear of a full bottle — close to the skin, holding all day, melting in instead of sitting on top.</p>
          <p>It’s talc-free, vegan, and made from four ingredients: arrowroot, kaolin clay, rice bran, and mica. Nothing else. That matters more to me now than it used to.</p>
        </section>

        {/* BENEFITS RECAP BOX */}
        <section style={{ padding: '24px 0' }}>
          <div style={{ border: `1px solid ${T.line}`, background: T.paper, padding: '28px 24px' }}>
            <h3 style={{ fontFamily: T.serif, fontWeight: 400, fontSize: 20, margin: '0 0 16px' }}>Why Women Choose VEIL:</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
              {['The wear of a full perfume bottle, from one jar', 'Talc-free, finely milled — glides on without weight', 'Pressed in, not sprayed — holds all day', 'Intimate, close-to-skin — never announces itself', 'Vegan and cruelty-free, always'].map((x) => (
                <li key={x} style={{ display: 'flex', gap: 10, fontSize: 15, color: T.ink }}>
                  <span style={{ color: T.soft }}>—</span>{x}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div style={{ textAlign: 'center', margin: '20px 0 36px' }}>
          <button className="cta-3d" onClick={handleClaim} disabled={claiming} style={{ ...ctaBtn, width: '100%', maxWidth: 420, height: 56, opacity: claiming ? 0.6 : 1 }}>
            {claiming ? 'Loading…' : `Claim ${DISCOUNT_CODE} — 15% Off →`}
          </button>
        </div>

        {/* GUARANTEE */}
        <section style={{ padding: '20px 0', textAlign: 'center' }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Try It Without the Risk</h2>
          <p style={{ color: T.soft, fontSize: 15, marginTop: 14, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6 }}>
            Every VEIL order is backed by a 30-day return policy. If it’s not the right fit, send it back for a full refund to your original payment method — no hoops to jump through.
          </p>
        </section>

        {/* URGENCY CLOSE */}
        <section style={{ padding: '20px 0', fontSize: 17, lineHeight: 1.7 }}>
          <h2 style={{ ...S.h2, fontSize: 'clamp(24px,3.6vw,30px)' }}>Ready to Feel Finished, Every Day?</h2>
          <p style={{ marginTop: 18 }}>From here, you really have two options.</p>
          <p><b>Option one</b> is to close this page and keep reaching for the same bottle that fades by 2 PM.</p>
          <p><b>Option two</b> is to try the jar that’s already changed how a lot of women think about wearing scent — for less than a third of what a bottle of perfume costs.</p>
          <p>The code <b>{DISCOUNT_CODE}</b> takes 15% off your first order, and it’s good the moment you claim it below.</p>
        </section>

        <div style={{ textAlign: 'center', margin: '20px 0 60px' }}>
          <button className="cta-3d" onClick={handleClaim} disabled={claiming} style={{ ...ctaBtn, width: '100%', maxWidth: 420, height: 56, opacity: claiming ? 0.6 : 1 }}>
            {claiming ? 'Loading…' : `Try VEIL Now — 15% off with code ${DISCOUNT_CODE}`}
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

      <style jsx global>{`
        .cta-3d:hover:not(:disabled) { filter: brightness(1.04); }
        .cta-3d:active:not(:disabled) {
          transform: translateY(4px);
          box-shadow: 0 1px 0 #C98200, 0 3px 8px rgba(201,130,0,0.3);
        }
      `}</style>
    </div>
  );
}
