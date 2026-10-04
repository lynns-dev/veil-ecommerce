import React from 'react';
import Link from 'next/link';
import Seo, { SITE_URL, SITE_NAME } from '../components/Seo';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import ProductVisual from '../components/ProductVisual';
import Marquee from '../components/Marquee';
import Footer from '../components/Footer';
import { getFeaturedProducts, PRODUCTS, INGREDIENTS } from '../lib/products';
import { useCart } from '../lib/useCart';
import { useAllReviews } from '../lib/useReviews';
import { T, S } from '../lib/theme';

export default function HomePage() {
  const c = useCart();
  const featured = getFeaturedProducts();
  // One column per distinct scent — the Grand Jar is the Original in a
  // bigger jar, so it would only repeat the Original's notes.
  const scentGuide = featured.filter((p) => p.id !== 'grand-jar' && p.notes);
  const shopList = PRODUCTS;
  const reviewsByProduct = useAllReviews();
  const siteReviews = React.useMemo(() => {
    const all = Object.values(reviewsByProduct).flatMap((r) => r.reviews || []);
    const count = all.length;
    const average = count === 0 ? 0 : Math.round((all.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
    const recommendPct = count === 0 ? 0 : Math.round((all.filter((r) => r.rating >= 4).length / count) * 100);
    return { all, count, average, recommendPct };
  }, [reviewsByProduct]);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/images/veil-logo-black.png`,
  };

  // Signals which pages are the site's primary sections — the standard
  // schema.org way to state that, alongside prominent, consistent links to
  // the same two pages from the global nav (components/Header.jsx) and
  // this page's own collection grid below. Worth being direct about what
  // this can and can't do: Google's own documentation says sitelinks (the
  // extra indented links Google sometimes shows under a search result) are
  // chosen algorithmically from real site structure and click behavior —
  // no markup, this included, can request or guarantee specific ones. This
  // is one honest input into that algorithm, not a lever that controls it.
  const siteNavigationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SiteNavigationElement',
    name: ['Shop', 'Original'],
    url: [`${SITE_URL}/shop`, `${SITE_URL}/product/original`],
  };

  return (
    <div>
      <Seo
        description="Veil is perfume in powder form, swept onto skin with a puff — inspired by the women we grew up admiring. Warm jasmine and vanilla, bright citrus, or pear and violet."
        path="/"
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavigationJsonLd) }}
      />
      {/* The promo bar that used to sit here is now rendered sitewide from
          pages/_app.jsx (components/AnnouncementBar.jsx). */}
      {/* HERO — the headline carries the feeling; the line beneath it must
          always say plainly what the product is (see the site brief). */}
      <section style={heroWrap}>
        <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} overlay scrolled={scrolled} />
        <div style={heroBg}>
          <div style={heroScrim} />
          <div style={heroContent}>
            <span style={{ ...S.label, display: 'block', marginBottom: 26, color: 'rgba(252,251,247,0.85)' }}>Perfume, in powder form</span>
            <h1 style={heroH1}>The woman you always <span style={S.it}>pictured becoming.</span></h1>
            <p style={heroSub}>
              Veil is perfume made as a fine powder. Press the puff into the jar, sweep it over your skin, and the scent stays close to you — the finishing touch of a woman who takes her time.
            </p>
            {siteReviews.count > 0 && (
              <div style={hrate}>
                <span style={{ letterSpacing: '2px', color: T.white }}>{'★'.repeat(Math.round(siteReviews.average))}{'☆'.repeat(5 - Math.round(siteReviews.average))}</span>
                {' '}{siteReviews.average.toFixed(1)} · {siteReviews.count} review{siteReviews.count === 1 ? '' : 's'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={heroBtn} onClick={() => c.add(featured[0])}>Add the Original — ${featured[0].price}</button>
              <Link href="/about" style={heroLink}>Our story</Link>
            </div>
          </div>
          <div style={heroHint}>
            <span style={heroHintLine} />
            <span style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(252,251,247,0.7)' }}>Scroll</span>
          </div>
        </div>
      </section>

      {/* WHAT IT IS — the three plain facts, before anything else. */}
      <section style={{ ...band, borderBottom: `1px solid ${T.line}` }}>
        <div className="facts-grid" style={factsGrid}>
          {[
            ['What it is', 'Perfume, made as a fine scented powder instead of a liquid. Talc-free.'],
            ['How it goes on', 'With a soft puff. Press it into the powder, then sweep it over your skin.'],
            ['How it wears', 'Close to the skin — noticed by the people near you, not the whole room.'],
          ].map(([h, p]) => (
            <div key={h} className="facts-item" style={factCell}>
              <p style={S.label}>{h}</p>
              <p style={factText}>{p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SCENTS — the collection, organized around choosing. */}
      <section id="scents" style={band}>
        <div style={{ ...S.wrap, textAlign: 'center' }}>
          <p style={S.label}>The scents</p>
          <h2 style={{ ...S.h2, marginTop: 12 }}>Every woman has her scent. <span style={S.it}>Find yours.</span></h2>
          <p style={sectionIntro}>
            Three scents, each in a 4 oz jar — the Original also comes in an 8 oz Grand Jar. Start with the notes you already love.
          </p>
          <div className="col-grid" style={colGrid}>
            {featured.map((p) => (
              <div key={p.id} className="col-item" style={pcard}>
                <Link href={`/product/${p.id}`} style={pimg}>
                  {p.badge && <span style={badge}>{p.badge}</span>}
                  <ProductVisual id={p.id} images={p.images} alt={p.name} width={104} />
                </Link>
                <div style={pcardText}>
                  <Link href={`/product/${p.id}`} style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 19 }}>{p.name}</Link>
                  <div style={pnotes}>{p.tagline}</div>
                  <p style={psmell}>{p.smellsLike}</p>
                  <p style={pchoose}><span style={{ color: T.ink }}>Choose it if</span> {p.chooseIf.charAt(0).toLowerCase() + p.chooseIf.slice(1)}</p>
                  <div style={{ fontSize: 13 }}>${p.price} · {p.size}</div>
                  <button style={{ ...S.btnFill, width: '100%', justifyContent: 'center', marginTop: 18 }} onClick={() => c.add(p)}>Add to bag</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 40 }}><Link href="/shop" style={S.link}>Shop everything, including sets</Link></div>
        </div>
      </section>

      {/* NOTES SIDE BY SIDE — every note comes from that scent's own
          `notes` in lib/products.js; nothing is shared between columns. */}
      <section id="notes" style={{ ...band, background: T.ink, color: T.white, textAlign: 'center' }}>
        <div style={S.wrap}>
          <p style={{ ...S.label, color: 'rgba(252,251,247,0.6)' }}>The notes</p>
          <h2 style={{ ...S.h2, color: T.white, marginTop: 12 }}>What each one <span style={S.it}>smells like.</span></h2>
          <p style={{ ...sectionIntro, color: 'rgba(252,251,247,0.72)' }}>
            Top notes are what you smell first. The heart comes through next. The base is what stays on your skin.
          </p>
          <div className="notes-grid" style={ncols}>
            {scentGuide.map((p) => (
              <div key={p.id} className="notes-item" style={ncol}>
                <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 22, marginBottom: 18 }}>{p.name}</div>
                {[['Top', p.notes.top], ['Heart', p.notes.middle], ['Base', p.notes.base]].map(([k, v]) => (
                  <div key={k} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(252,251,247,0.55)', marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.5 }}>{v}</div>
                  </div>
                ))}
                <Link href={`/product/${p.id}`} style={{ ...S.link, color: T.white, borderBottom: '1px solid rgba(252,251,247,0.5)', marginTop: 8, display: 'inline-block' }}>Shop {p.name}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW TO WEAR IT */}
      <section style={band}>
        <div className="how-grid" style={splitGrid}>
          <div style={splitImg}>
            <img
              src="/images/veil-model-7.9.png"
              alt="A woman sweeping a powder puff over her shoulder, a jar of Veil beside her"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
          <div>
            <p style={S.label}>How to wear it</p>
            <h2 style={{ ...S.h2, marginTop: 12, textAlign: 'left' }}>The last touch <span style={S.it}>before you leave.</span></h2>
            <ol style={stepsList}>
              {HOW_TO_WEAR.map(([h, p], i) => (
                <li key={h} style={{ ...stepRow, borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>
                  <span style={stepNum}>{i + 1}</span>
                  <div>
                    <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 19, marginBottom: 4 }}>{h}</div>
                    <p style={{ fontSize: 14, color: T.soft, margin: 0 }}>{p}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* THE STORY, IN SHORT — the full telling lives on /about. Here it
          only frames the product as who she has become; no retelling. */}
      <section style={{ ...band, background: T.paper, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div className="why-grid" style={splitGrid}>
          <div>
            <p style={S.label}>Why we made Veil</p>
            <h2 style={{ ...S.h2, marginTop: 12, textAlign: 'left' }}>Inspired by the women <span style={S.it}>we grew up admiring.</span></h2>
            <div style={storyText}>
              <p>As girls, we watched them get ready — unhurried, sure of their taste, finishing with a scent that was entirely theirs. We pictured the woman we’d one day become.</p>
              <p>Veil is that finishing touch, made for now: perfume in powder form, swept on with a puff. Not to become anyone else. To become her — your way.</p>
            </div>
            <Link href="/about" style={{ ...S.link, display: 'inline-block', marginTop: 26 }}>Read our story</Link>
          </div>
          <div style={splitImg}>
            <img
              src="/images/veil-puff-shoulder-hoop.webp"
              alt="A woman with her hair pinned up, pressing a powder puff to her shoulder"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>
      </section>

      {/* THE FACTS — prices and sizes come straight from lib/products.js;
          shipping and returns mirror pages/shipping.jsx and
          pages/returns.jsx. */}
      <section style={band}>
        <div style={{ ...S.wrap, textAlign: 'center' }}>
          <p style={S.label}>The details</p>
          <h2 style={{ ...S.h2, marginTop: 12 }}>Sizes, prices, <span style={S.it}>and what’s inside.</span></h2>
          <div className="facts-table" style={factsTable}>
            <div style={factsCol}>
              <p style={{ ...S.label, marginBottom: 14 }}>Sizes &amp; prices</p>
              {shopList.map((p) => (
                <div key={p.id} style={priceRow}>
                  <Link href={`/product/${p.id}`} style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 17 }}>{p.name}</Link>
                  <span style={{ fontSize: 14, color: T.soft, whiteSpace: 'nowrap' }}>{p.size} · ${p.price}</span>
                </div>
              ))}
            </div>
            <div style={factsCol}>
              <p style={{ ...S.label, marginBottom: 14 }}>Ingredients</p>
              <p style={{ fontSize: 14, color: T.ink, margin: '0 0 22px' }}>{INGREDIENTS}</p>
              <p style={{ fontSize: 14, color: T.soft, margin: '0 0 22px' }}>Talc-free. Vegan and cruelty-free.</p>
              <p style={{ ...S.label, marginBottom: 14 }}>Shipping &amp; returns</p>
              <p style={{ fontSize: 14, color: T.soft, margin: 0 }}>
                US shipping is a flat $5, free on orders of $50 or more. Orders ship within 1 business day. Unopened, unused products can be returned within 30 days of delivery.{' '}
                <Link href="/shipping" style={{ textDecoration: 'underline' }}>Shipping</Link> · <Link href="/returns" style={{ textDecoration: 'underline' }}>Returns</Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS — only what customers have submitted and admin approved
          (lib/useReviews.js). Never seed or invent entries here. */}
      <section id="reviews" style={{ ...band, background: T.paper, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ ...S.wrap, textAlign: 'center' }}>
          <p style={S.label}>Reviews</p>
          <h2 style={{ ...S.h2, marginTop: 12 }}>In customers’ <span style={S.it}>own words.</span></h2>
          {siteReviews.count === 0 ? (
            <p style={{ color: T.soft, fontSize: 14, marginTop: 42 }}>No reviews yet — be the first to share yours on any product page.</p>
          ) : (
            <>
              <div style={{ marginTop: 42 }}>
                <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 56, lineHeight: 1 }}>{siteReviews.average.toFixed(1)}</div>
                <div style={{ color: T.ink, letterSpacing: '3px', fontSize: 14, margin: '6px 0 4px' }}>{'★'.repeat(Math.round(siteReviews.average))}{'☆'.repeat(5 - Math.round(siteReviews.average))}</div>
                <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.soft }}>{siteReviews.count} review{siteReviews.count === 1 ? '' : 's'} · {siteReviews.recommendPct}% rated 4 stars or more</div>
              </div>
              <div className="rev-grid" style={revGrid}>
                {siteReviews.all.slice().reverse().slice(0, 3).map((r) => (
                  <div key={r.id} className="rev-item" style={rev}>
                    <div style={{ color: T.ink, letterSpacing: '1.5px', fontSize: 12, marginBottom: 14 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                    <p style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 19, lineHeight: 1.4, marginBottom: 16 }}>“{r.text}”</p>
                    <cite style={{ fontStyle: 'normal', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.soft }}>{r.author}</cite>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* NEWSLETTER */}
      <section style={{ ...band, textAlign: 'center' }}>
        <p style={S.label}>The list</p>
        <h2 style={{ ...S.h2, marginTop: 12 }}>New scents, <span style={S.it}>first.</span></h2>
        <p style={{ color: T.soft, fontSize: 15, margin: '16px auto 28px', maxWidth: '40ch' }}>Early access, the occasional letter, 15% off your first order.</p>
        <form style={newsForm} onSubmit={(e) => e.preventDefault()}>
          <input type="email" placeholder="Email address" aria-label="email" style={newsInput} />
          <button type="submit" style={{ background: 'none', border: 'none', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: T.sans }}>Subscribe</button>
        </form>
      </section>

      <Marquee />
      <Footer />

      <CartDrawer {...c} onClose={() => c.setOpen(false)} />

      <style jsx>{`
        .facts-grid { grid-template-columns: repeat(3, 1fr); }
        .facts-item + .facts-item { border-left: 1px solid ${T.line}; }
        .col-grid { grid-template-columns: repeat(4, 1fr); }
        .notes-grid { grid-template-columns: repeat(3, 1fr); }
        .notes-item:nth-child(n + 2) { border-left: 1px solid ${T.dline}; }
        .how-grid, .why-grid { grid-template-columns: 1fr 1fr; }
        .facts-table { grid-template-columns: 1fr 1fr; }
        .rev-grid { grid-template-columns: repeat(3, 1fr); }
        .rev-item:nth-child(n + 2) { border-left: 1px solid ${T.line}; }

        @media (max-width: 960px) {
          .col-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 680px) {
          .facts-grid { grid-template-columns: 1fr; }
          .facts-item + .facts-item { border-left: none; border-top: 1px solid ${T.line}; }
          .col-grid { grid-template-columns: 1fr; }
          .notes-grid { grid-template-columns: 1fr; }
          .notes-item { border-left: none; }
          .notes-item:nth-child(n + 2) { border-left: none; border-top: 1px solid ${T.dline}; }
          .how-grid, .why-grid { grid-template-columns: 1fr; gap: 34px; }
          .why-grid > div:last-child { order: -1; }
          .facts-table { grid-template-columns: 1fr; }
          .rev-grid { grid-template-columns: 1fr; }
          .rev-item { border-left: none; }
          .rev-item:nth-child(n + 2) { border-left: none; border-top: 1px solid ${T.line}; }
        }
      `}</style>
    </div>
  );
}

// The application steps, in the order they happen. Mirrors HOW_TO_USE on
// the product page — same instructions, same words.
const HOW_TO_WEAR = [
  ['Press the puff into the powder', 'Press gently — you only need a light layer.'],
  ['Sweep it over your skin', 'Collarbones, shoulders, the backs of the knees — wherever you’d wear perfume. A light layer, not a coat.'],
  ['Wear it on warm, clean skin', 'Just after a bath or shower is ideal. Wear it alone, or over your usual perfume.'],
];

const heroWrap = { position: 'relative' };
const heroBg = {
  position: 'relative', height: '88vh', minHeight: 560,
  backgroundImage: 'url(/images/veil-model-powder-puff.png)', backgroundSize: 'cover', backgroundPosition: '65% 75%',
  display: 'flex', alignItems: 'flex-end',
};
const heroScrim = {
  position: 'absolute', inset: 0,
  background: 'linear-gradient(100deg, rgba(22,20,15,0.72) 0%, rgba(22,20,15,0.4) 42%, rgba(22,20,15,0.05) 68%)',
};
const heroContent = { position: 'relative', maxWidth: T.maxw, width: '100%', margin: '0 auto', padding: '0 40px 72px', color: T.white };
const heroH1 = { fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(40px,5.6vw,72px)', lineHeight: 1.02, marginBottom: 22, color: T.white, maxWidth: '16ch' };
const heroSub = { fontSize: 16, color: 'rgba(252,251,247,0.82)', maxWidth: '38ch', marginBottom: 26 };
const hrate = { display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: 'rgba(252,251,247,0.82)', marginBottom: 30 };
const heroBtn = { ...S.btnFill, background: T.white, color: T.ink };
const heroLink = { ...S.link, color: T.white, borderBottom: '1px solid rgba(252,251,247,0.5)' };
const heroHint = { position: 'absolute', left: '50%', bottom: 28, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 };
const heroHintLine = { width: 1, height: 34, background: 'rgba(252,251,247,0.6)' };
const band = { padding: '64px 0' };
const colGrid = { display: 'grid', marginTop: 50, gap: 40 };
const pcard = { textAlign: 'center' };
const badge = { position: 'absolute', top: 14, left: 14, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.soft, background: 'rgba(252,251,247,0.9)', padding: '4px 8px', zIndex: 1 };
const pimg = { position: 'relative', aspectRatio: '1/1', display: 'block', overflow: 'hidden', width: '100%' };
const pcardText = { padding: '20px 14px 40px' };
const pnotes = { fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, margin: '8px 0 6px' };
const revGrid = { display: 'grid', border: `1px solid ${T.line}`, marginTop: 48 };
const rev = { padding: '34px 30px', textAlign: 'left' };
const ncols = { display: 'grid', maxWidth: 980, margin: '44px auto 0', border: `1px solid ${T.dline}` };
const ncol = { padding: '38px 24px' };
const sectionIntro = { color: T.soft, fontSize: 15, maxWidth: '52ch', margin: '16px auto 0' };
const factsGrid = { ...S.wrap, display: 'grid' };
const factCell = { padding: '6px 32px', textAlign: 'center' };
const factText = { fontFamily: T.serif, fontWeight: 300, fontSize: 19, lineHeight: 1.45, marginTop: 10, maxWidth: '26ch', marginLeft: 'auto', marginRight: 'auto' };
const psmell = { fontSize: 14, color: T.ink, margin: '10px 0 6px', lineHeight: 1.5 };
const pchoose = { fontSize: 13, color: T.soft, margin: '0 0 12px', lineHeight: 1.5 };
const splitGrid = { ...S.wrap, display: 'grid', gap: 60, alignItems: 'center' };
const splitImg = { aspectRatio: '4/5', overflow: 'hidden', border: `1px solid ${T.line}` };
const stepsList = { listStyle: 'none', padding: 0, margin: '30px 0 0' };
const stepRow = { display: 'flex', gap: 20, padding: '18px 0' };
const stepNum = { fontFamily: T.serif, fontStyle: 'italic', fontWeight: 300, fontSize: 24, lineHeight: 1, minWidth: 18 };
const storyText = { fontSize: 16, lineHeight: 1.75, color: T.ink, marginTop: 22, maxWidth: '46ch', display: 'grid', gap: 14 };
const factsTable = { display: 'grid', gap: 48, marginTop: 44, textAlign: 'left', borderTop: `1px solid ${T.line}`, paddingTop: 34 };
const factsCol = {};
const priceRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '10px 0', borderBottom: `1px solid ${T.line}` };
const newsForm = { display: 'flex', maxWidth: 420, margin: '0 auto', borderBottom: `1px solid ${T.ink}` };
const newsInput = { flex: 1, height: 48, border: 'none', background: 'transparent', color: T.ink, padding: '0 4px', fontSize: 14, fontFamily: T.sans, outline: 'none' };
