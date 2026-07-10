import React from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import ProductVisual from '../components/ProductVisual';
import Marquee from '../components/Marquee';
import Footer from '../components/Footer';
import { getFeaturedProducts, getProductById } from '../lib/products';
import { useCart } from '../lib/useCart';
import { T, S } from '../lib/theme';

const BANNER_MESSAGES = ['Free shipping $50+', '15% off with code VEIL15'];

export default function HomePage() {
  const c = useCart();
  const featured = getFeaturedProducts();
  const violette = getProductById('violette');
  const [bannerIndex, setBannerIndex] = React.useState(0);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const id = setInterval(() => {
      setBannerIndex((i) => (i + 1) % BANNER_MESSAGES.length);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div>
      <div style={announce}>
        <div
          style={{
            display: 'flex',
            width: `${BANNER_MESSAGES.length * 100}%`,
            transform: `translateX(-${(100 / BANNER_MESSAGES.length) * bannerIndex}%)`,
            transition: 'transform 0.6s ease',
          }}
        >
          {BANNER_MESSAGES.map((msg, i) => (
            <span key={i} style={{ width: `${100 / BANNER_MESSAGES.length}%` }}>{msg}</span>
          ))}
        </div>
      </div>
      {/* HERO */}
      <section style={heroWrap}>
        <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} overlay scrolled={scrolled} />
        <div style={heroBg}>
          <div style={heroScrim} />
          <div style={heroContent}>
            <span style={{ ...S.label, display: 'block', marginBottom: 26, color: 'rgba(252,251,247,0.85)' }}>Poudre de corps parfumée</span>
            <h1 style={heroH1}>Wear it <span style={S.it}>for yourself</span> first.</h1>
            <p style={heroSub}>A featherlight perfume powder that melts into skin and lingers all day — noticed only by those who lean in close.</p>
            <div style={hrate}><span style={{ letterSpacing: '2px', color: T.white }}>★★★★★</span> 4.9 · 2,143 reviews</div>
            <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
              <button style={heroBtn} onClick={() => c.add(featured[0])}>Shop — $45</button>
              <a href="#notes" style={heroLink}>The scent</a>
            </div>
          </div>
          <div style={heroHint}>
            <span style={heroHintLine} />
            <span style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(252,251,247,0.7)' }}>Scroll</span>
          </div>
        </div>
      </section>

      {/* COLLECTION */}
      <section id="shop" style={band}>
        <div style={{ ...S.wrap, textAlign: 'center' }}>
          <p style={S.label}>The collection</p>
          <h2 style={{ ...S.h2, marginTop: 12 }}>A scent wardrobe, <span style={S.it}>softly told.</span></h2>
          <div className="col-grid" style={colGrid}>
            {featured.map((p) => (
              <div key={p.id} className="col-item" style={pcard}>
                <Link href={`/product/${p.id}`} style={pimg}>
                  {p.badge && <span style={badge}>{p.badge}</span>}
                  <ProductVisual id={p.id} images={p.images} alt={p.name} width={104} />
                </Link>
                <div style={pcardText}>
                  <Link href={`/product/${p.id}`} style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 25 }}>{p.name}</Link>
                  <div style={pnotes}>{p.tagline}</div>
                  <div style={{ fontSize: 13 }}>${p.price} · {p.size}</div>
                  <button style={{ ...S.btnFill, width: '100%', justifyContent: 'center', marginTop: 18 }} onClick={() => c.add(p)}>Add to cart</button>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 40 }}><Link href="/shop" style={S.link}>View all</Link></div>
        </div>
      </section>

      {/* NEW SCENT — VIOLETTE AMBRÉE */}
      {violette && (
        <section style={{ ...band, borderTop: `1px solid ${T.line}` }}>
          <div className="new-scent-grid" style={newScentGrid}>
            <div style={newScentImg}>
              <img
                src="/images/violette-scent.png"
                alt="Violette Ambrée — pear, plum, lily of the valley, violet, amber, warm woods"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>
            <div>
              <p style={S.label}>New scent</p>
              <h2 style={{ ...S.h2, marginTop: 12, textAlign: 'left' }}>Violette Ambrée<span style={S.it}>, just arrived.</span></h2>
              <p style={{ color: T.soft, fontSize: 15, margin: '18px 0 26px', maxWidth: '42ch' }}>{violette.description}</p>
              <Link href={`/product/${violette.id}`} style={S.btnFill}>Shop Violette Ambrée</Link>
            </div>
          </div>
        </section>
      )}

      {/* HONEST MATH */}
      <section style={{ ...band, background: T.paper, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ ...S.wrap, textAlign: 'center' }}>
          <p style={S.label}>The honest math</p>
          <h2 style={{ ...S.h2, marginTop: 12 }}>Same scent. <span style={S.it}>Less the markup.</span></h2>
          <div className="hm-grid" style={{ display: 'grid', marginTop: 46, border: `1px solid ${T.line}`, textAlign: 'left' }}>
            <div className="hm-cell" style={vcell}>
              <div style={vtag}>Luxury perfume</div>
              <div style={vbig}>$150–300</div>
              <ul style={vlist}>
                {['One bottle', 'Scents you and the whole room', 'Fades by afternoon', 'Sits on top of the skin'].map((x, i) => (
                  <li key={i} style={{ ...vli, borderTop: i === 0 ? 'none' : `1px solid ${T.line}` }}>{x}</li>
                ))}
              </ul>
            </div>
            <div className="hm-cell" style={{ ...vcell, background: T.ink, color: T.white }}>
              <div style={{ ...vtag, color: 'rgba(252,251,247,0.6)' }}>One jar of VEIL</div>
              <div style={{ ...vbig, color: T.white }}>$45</div>
              <ul style={vlist}>
                {['The wear of a full bottle', 'Intimate, close-to-skin', 'Pressed in — holds all day', 'Melts in, soft-focus finish'].map((x, i) => (
                  <li key={i} style={{ ...vli, color: 'rgba(252,251,247,0.78)', borderTop: i === 0 ? 'none' : `1px solid ${T.dline}` }}>{x}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* REVIEWS */}
      <section id="reviews" style={{ ...band, background: T.paper, borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
        <div style={{ ...S.wrap, textAlign: 'center' }}>
          <p style={S.label}>The verdict</p>
          <h2 style={{ ...S.h2, marginTop: 12 }}>Worn close, <span style={S.it}>adored quietly.</span></h2>
          <div style={{ marginTop: 42 }}>
            <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 56, lineHeight: 1 }}>4.9</div>
            <div style={{ color: T.ink, letterSpacing: '3px', fontSize: 14, margin: '6px 0 4px' }}>★★★★★</div>
            <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.soft }}>2,143 reviews · 97% recommend</div>
          </div>
          <div className="rev-grid" style={revGrid}>
            {[
              ['★★★★★', '“Three people leaned in at dinner to ask what I was wearing. Still there at midnight.”', 'Renata M. — Verified'],
              ['★★★★★', '“Layered it for a wedding — eleven hours later mine was the only scent still going.”', 'Joanne T. — Verified'],
              ['★★★★', '“Close-to-skin by design, not a room-filler. For a soft personal trail, it’s flawless.”', 'Dana P. — Verified'],
            ].map(([st, quote, who], i) => (
              <div key={i} className="rev-item" style={rev}>
                <div style={{ color: T.ink, letterSpacing: '1.5px', fontSize: 12, marginBottom: 14 }}>{st}</div>
                <p style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 19, lineHeight: 1.4, marginBottom: 16 }}>{quote}</p>
                <cite style={{ fontStyle: 'normal', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.soft }}>{who}</cite>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: T.soft, marginTop: 24, letterSpacing: '0.04em' }}>Sample reviews shown — connect a verified-review app before launch.</p>
        </div>
      </section>

      {/* NOTES */}
      <section id="notes" style={{ ...band, background: T.ink, color: T.white, textAlign: 'center' }}>
        <div style={S.wrap}>
          <p style={{ ...S.label, color: 'rgba(252,251,247,0.6)' }}>The composition</p>
          <h2 style={{ ...S.h2, color: T.white, marginTop: 12 }}>Built in layers, <span style={S.it}>unfolding slowly.</span></h2>
          <div className="notes-grid" style={ncols}>
            {[['Top', 'Bergamot', 'Citrus zest'], ['Heart', 'Jasmine', 'Soft floral petals'], ['Base', 'Hinoki · Santal', 'Warm vanilla']].map(([k, a, b], i) => (
              <div key={i} className="notes-item" style={ncol}>
                <div style={{ fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(252,251,247,0.55)', marginBottom: 14 }}>{k}</div>
                <div style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 21, lineHeight: 1.5 }}>{a}<br />{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RITUAL */}
      <section style={band}>
        <div style={{ ...S.wrap, textAlign: 'center' }}>
          <p style={S.label}>The ritual</p>
          <h2 style={{ ...S.h2, marginTop: 12 }}>Three soft motions.</h2>
          <div className="rit-grid" style={ritGrid}>
            {[['i', 'After the bath', 'Press the puff into the powder. Scent lives best on warm, clean skin.'],
              ['ii', 'Sweep where you’re noticed', 'Collarbones, shoulders, the backs of the knees. A veil, not a coat.'],
              ['iii', 'Carry it through the day', 'Wear alone, or layer over perfume to extend it.']].map(([n, h, p], i) => (
              <div key={i}>
                <div style={{ fontFamily: T.serif, fontStyle: 'italic', fontWeight: 300, fontSize: 26 }}>{n}</div>
                <h4 style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 21, margin: '12px 0 6px' }}>{h}</h4>
                <p style={{ fontSize: 13, color: T.soft, maxWidth: '30ch', margin: '0 auto' }}>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section style={{ ...band, textAlign: 'center', borderTop: `1px solid ${T.line}` }}>
        <p style={S.label}>The list</p>
        <h2 style={{ ...S.h2, marginTop: 12 }}>A language of scent, <span style={S.it}>told softly.</span></h2>
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
        .hm-grid { grid-template-columns: 1fr 1fr; }
        .hm-cell + .hm-cell { border-left: 1px solid ${T.line}; }
        .col-grid { grid-template-columns: repeat(4, 1fr); }
        .new-scent-grid { grid-template-columns: 1fr 1fr; }
        .rev-grid { grid-template-columns: repeat(3, 1fr); }
        .rev-item:nth-child(n + 2) { border-left: 1px solid ${T.line}; }
        .notes-grid { grid-template-columns: repeat(3, 1fr); }
        .notes-item:nth-child(n + 2) { border-left: 1px solid ${T.dline}; }
        .rit-grid { grid-template-columns: repeat(3, 1fr); }

        @media (max-width: 680px) {
          .hm-grid { grid-template-columns: 1fr; }
          .hm-cell + .hm-cell { border-left: none; border-top: 1px solid ${T.line}; }
          .col-grid { grid-template-columns: 1fr; }
          .new-scent-grid { grid-template-columns: 1fr; gap: 34px; }
          .rev-grid { grid-template-columns: 1fr; }
          .rev-item { border-left: none; }
          .rev-item:nth-child(n + 2) { border-left: none; border-top: 1px solid ${T.line}; }
          .notes-grid { grid-template-columns: 1fr; }
          .notes-item { border-left: none; }
          .notes-item:nth-child(n + 2) { border-left: none; border-top: 1px solid ${T.dline}; }
          .rit-grid { grid-template-columns: 1fr; gap: 34px; }
        }
      `}</style>
    </div>
  );
}

const announce = { textAlign: 'center', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: T.white, background: T.ink, padding: '14px 20px', borderBottom: `1px solid ${T.dline}`, overflow: 'hidden' };
const heroWrap = { position: 'relative' };
const heroBg = {
  position: 'relative', height: '88vh', minHeight: 560,
  backgroundImage: 'url(/images/veil-model-7.9.png)', backgroundSize: 'cover', backgroundPosition: 'center 25%',
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
const vcell = { padding: '46px 44px' };
const vtag = { fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: T.soft, marginBottom: 18 };
const vbig = { fontFamily: T.serif, fontWeight: 300, fontSize: 46, lineHeight: 1, marginBottom: 18 };
const vlist = { listStyle: 'none', fontSize: 14, color: T.soft };
const vli = { padding: '8px 0' };
const colGrid = { display: 'grid', marginTop: 50, gap: 40 };
const newScentGrid = { ...S.wrap, display: 'grid', gap: 60, alignItems: 'center' };
const newScentImg = { aspectRatio: '4/5', overflow: 'hidden', border: `1px solid ${T.line}` };
const pcard = { textAlign: 'center' };
const badge = { position: 'absolute', top: 14, left: 14, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: T.soft, background: 'rgba(252,251,247,0.9)', padding: '4px 8px', zIndex: 1 };
const pimg = { position: 'relative', aspectRatio: '1/1', display: 'block', overflow: 'hidden', width: '100%' };
const pcardText = { padding: '20px 30px 40px' };
const pnotes = { fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: T.soft, margin: '8px 0 6px' };
const revGrid = { display: 'grid', border: `1px solid ${T.line}`, marginTop: 48 };
const rev = { padding: '34px 30px', textAlign: 'left' };
const ncols = { display: 'grid', maxWidth: 820, margin: '48px auto 0', border: `1px solid ${T.dline}` };
const ncol = { padding: '38px 14px' };
const ritGrid = { display: 'grid', gap: 44, marginTop: 54 };
const newsForm = { display: 'flex', maxWidth: 420, margin: '0 auto', borderBottom: `1px solid ${T.ink}` };
const newsInput = { flex: 1, height: 48, border: 'none', background: 'transparent', color: T.ink, padding: '0 4px', fontSize: 14, fontFamily: T.sans, outline: 'none' };
