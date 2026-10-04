import React from 'react';
import Link from 'next/link';
import Seo from '../components/Seo';
import Header from '../components/Header';
import CartDrawer from '../components/CartDrawer';
import Marquee from '../components/Marquee';
import Footer from '../components/Footer';
import { useCart } from '../lib/useCart';
import { T, S } from '../lib/theme';

// The brand story, told in full — the only page that tells it start to
// finish. Every other page carries the same idea (she is becoming the woman
// she grew up admiring) in a line or two and links here, rather than
// retelling it. The past appears only on this page; it stays contemporary
// in look and language: no vintage styling, no "grandmother", no ageing talk.
export default function AboutPage() {
  const c = useCart();
  return (
    <div>
      <Seo
        title="Our story"
        description="Veil was inspired by the women we grew up admiring — and the grace they wore so easily. Perfume in powder form, swept onto skin with a puff."
        path="/about"
      />
      <Header cartCount={c.count} onCartClick={() => c.setOpen(true)} />

      <section style={hero}>
        <div style={heroScrim} />
        <div style={{ ...S.wrap, position: 'relative', textAlign: 'center' }}>
          <p style={{ ...S.label, color: 'rgba(252,251,247,0.8)' }}>Our story</p>
          <h1 style={heroH1}>The women we grew up <span style={S.it}>watching.</span></h1>
        </div>
      </section>

      <article style={story}>
        <p style={lead}>Most of us can picture her. The woman we watched getting ready when we were small.</p>

        <p>She never rushed. She chose her scent the way she chose her earrings — with intention. Then came the last touch: a soft puff pressed to her skin, and a scent that stayed in the room after she’d gone.</p>

        <p>We didn’t have a word for it then. We only knew that one day, we wanted to be her.</p>

        <figure style={figure}>
          <img
            src="/images/veil-puff-shoulder-hoop.webp"
            alt="A woman with her hair pinned up, pressing a powder puff to her shoulder"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </figure>

        <p style={lead}>You pictured her clearly: the woman you’d grow into.</p>

        <p>Unhurried. Sure of her taste. A scent that was hers alone, worn close enough that only the people near her would know it.</p>

        <p>Veil began with that picture. It’s perfume made as a fine powder, swept onto the skin with a puff — the same unhurried gesture, made for now. Talc-free and light on the skin, in scents chosen to be worn as your own.</p>

        <p>Press the puff into the jar. Sweep it over your collarbones, your shoulders. That’s all. The rest is simply how you carry yourself.</p>

        <p style={closing}>Somewhere along the way, you became the woman you used to watch.<br /><span style={S.it}>You simply do it your own way.</span></p>

        <div style={{ textAlign: 'center', marginTop: 46 }}>
          <Link href="/#scents" style={S.btnFill}>Find your scent</Link>
        </div>
      </article>

      <Marquee />
      <Footer />
      <CartDrawer {...c} onClose={() => c.setOpen(false)} />
    </div>
  );
}

const hero = {
  position: 'relative', minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center',
  backgroundImage: 'url(/images/veil-model-7.9.png)', backgroundSize: 'cover', backgroundPosition: 'center 30%',
};
const heroScrim = { position: 'absolute', inset: 0, background: 'rgba(22,20,15,0.5)' };
const heroH1 = { ...S.h2, color: T.white, fontSize: 'clamp(38px,5.6vw,64px)', marginTop: 14 };
const story = {
  maxWidth: 640, margin: '0 auto', padding: '72px 24px 88px',
  fontSize: 17, lineHeight: 1.8, color: T.ink, display: 'grid', gap: 22,
};
const lead = { fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(24px,3vw,30px)', lineHeight: 1.35, margin: '12px 0 0' };
const figure = { margin: '26px 0', aspectRatio: '4/5', overflow: 'hidden', border: `1px solid ${T.line}` };
const closing = { fontFamily: T.serif, fontWeight: 300, fontSize: 'clamp(24px,3vw,30px)', lineHeight: 1.4, textAlign: 'center', margin: '30px 0 0' };
