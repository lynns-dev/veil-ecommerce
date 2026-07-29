import React from 'react';
import { T } from '../lib/theme';

// The rotating promo bar that used to live inline at the top of the homepage
// only. It's a component now so every storefront page carries the same
// offers — a shopper landing on a product page from an ad saw none of this
// before, which is exactly the traffic the offers are meant to convert.
//
// Keep these to claims the store actually honors. The free gift is
// unconditional: checkout adds the Tassel to every order regardless of cart
// value (see pages/checkout.jsx), so this promises nothing the cart won't
// deliver. Free shipping genuinely starts at $50 (components/CartDrawer.jsx).
const DEFAULT_MESSAGES = [
  'Free gift with every order',
  'Free shipping $50+',
  '15% off with code VEIL15',
];

const ROTATE_MS = 3500;

export default function AnnouncementBar({ messages = DEFAULT_MESSAGES }) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (messages.length < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % messages.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [messages.length]);

  if (messages.length === 0) return null;

  return (
    <div style={bar}>
      {/* aria-live so the rotation is announced to a screen reader rather
          than silently swapping text out from under it. */}
      <div className="announce-track" style={{ ...track, width: `${messages.length * 100}%`, transform: `translateX(-${(100 / messages.length) * index}%)` }} aria-live="polite">
        {messages.map((msg, i) => (
          <span key={msg} style={{ width: `${100 / messages.length}%` }} aria-hidden={i !== index}>{msg}</span>
        ))}
      </div>
      <style jsx>{`
        .announce-track { transition: transform 0.6s ease; }
        @media (prefers-reduced-motion: reduce) {
          .announce-track { transition: none; }
        }
      `}</style>
    </div>
  );
}

const bar = {
  textAlign: 'center', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase',
  color: T.white, background: T.ink, padding: '14px 20px',
  borderBottom: `1px solid ${T.dline}`, overflow: 'hidden',
};
const track = { display: 'flex' };
