import React from 'react';
import { getSessionId } from '../lib/session';

// "Reveal Your Reserve" — a quiet, three-panel scratch-off card, not a
// gamified wheel. Self-contained: the prizes (and everything else
// campaign-specific) come in as props so this can be reused/swapped
// without touching the interaction or drawing logic below.
//
// Trigger: exit-intent (cursor leaving toward the top of the viewport) OR
// a dwell timer, whichever comes first — never on load. sessionStorage
// keeps it to once per session; closing early or finishing the card both
// count as "shown," so it won't reappear later in the same session either way.
//
// Scratching each of the three panels only confirms what's been won (a
// label like "10% Off") — the actual redeemable codes stay masked until
// email + phone are submitted, at which point they're recorded as a lead
// (lib/checkoutLeadsStore.js, source: 'scratch-popup') feeding the same
// subscriber pipeline as abandoned-checkout capture. The codes are still
// client-side props either way, so this gate is a UX/lead step, not a
// security boundary — it's not meant to stop someone from reading them out
// of the page source, only to make giving contact info the path of least
// resistance for getting them normally.

const INK = '#16140F';
const PAPER = '#FAF8F4';
const SESSION_KEY = 'veil-reserve-shown';
const DWELL_MS = 15000;
const CLEAR_THRESHOLD = 0.6;
const SCRATCH_RADIUS = 18;

const DEFAULT_PRIZES = [
  { label: '10% Off', code: 'WELCOME10' },
  { label: '15% Off', code: 'RESERVED15' },
  { label: '20% Off', code: 'RESERVE20' },
];

// A faint line-illustration puff — an outlined circle with a small ribbon
// knot, not a literal product photo. Drawn at low opacity straight onto
// the scratch layer so each panel reads as "something is under here"
// without ever being a distraction once revealed.
function drawScratchLayer(ctx, width, height) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = PAPER;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1.2;

  const cx = width / 2;
  const cy = height / 2 - 4;
  const r = Math.min(width, height) * 0.2;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + r + 4);
  ctx.lineTo(cx, cy + r + 11);
  ctx.lineTo(cx + 7, cy + r + 4);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// One scratch-off panel — owns its own canvas, its own scratch progress,
// and reports upward only the moment it crosses the reveal threshold.
// Kept as its own component (rather than three parallel sets of refs/state
// in the parent) since hooks can't be looped or conditionally called.
function ScratchPanel({ label, code, unlocked, onRevealed }) {
  const [panelRevealed, setPanelRevealed] = React.useState(false);
  const [fading, setFading] = React.useState(false);
  const [gone, setGone] = React.useState(false);

  const canvasRef = React.useRef(null);
  const scratchingRef = React.useRef(false);
  const revealedRef = React.useRef(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    drawScratchLayer(ctx, rect.width, rect.height);

    const getPos = (e) => {
      const r = canvas.getBoundingClientRect();
      const point = e.touches ? e.touches[0] : e;
      return { x: point.clientX - r.left, y: point.clientY - r.top };
    };

    const scratchAt = (x, y) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, SCRATCH_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    };

    // Sampled, not exhaustive — reading every pixel on every stroke would
    // stutter the drag. A coarse grid is plenty accurate for a single
    // "have we crossed 60%?" check.
    const measureCleared = () => {
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      const step = 8;
      let total = 0;
      let clear = 0;
      for (let i = 3; i < data.length; i += 4 * step) {
        total += 1;
        if (data[i] === 0) clear += 1;
      }
      return total > 0 ? clear / total : 0;
    };

    const handleMove = (e) => {
      if (!scratchingRef.current || revealedRef.current) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      scratchAt(x, y);
      if (measureCleared() >= CLEAR_THRESHOLD) {
        revealedRef.current = true;
        setPanelRevealed(true);
        setFading(true);
        onRevealed();
      }
    };

    const handleDown = (e) => {
      scratchingRef.current = true;
      const { x, y } = getPos(e);
      scratchAt(x, y);
    };
    const handleUp = () => {
      scratchingRef.current = false;
    };

    canvas.addEventListener('mousedown', handleDown);
    canvas.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    canvas.addEventListener('touchstart', handleDown, { passive: true });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleUp);

    return () => {
      canvas.removeEventListener('mousedown', handleDown);
      canvas.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      canvas.removeEventListener('touchstart', handleDown);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('touchend', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!fading) return;
    const t = setTimeout(() => setGone(true), 400);
    return () => clearTimeout(t);
  }, [fading]);

  return (
    <div className="reserve-scratch-panel" style={panelWrapStyle}>
      <div style={panelRevealStyle}>
        {panelRevealed ? (
          <>
            <div style={panelLabelStyle}>{label}</div>
            {unlocked && <div style={panelCodeStyle}>{code}</div>}
          </>
        ) : null}
      </div>
      {!gone && (
        <canvas
          ref={canvasRef}
          style={{ ...panelCanvasStyle, opacity: fading ? 0 : 1, transition: 'opacity 400ms ease' }}
        />
      )}
    </div>
  );
}

export default function ReserveScratchPopup({
  prizes = DEFAULT_PRIZES,
  headline = 'Some things are worth uncovering slowly.',
  subtext = 'A private offer, reserved for you.',
  validityNote = 'Valid for 48 hours — because good things don’t wait forever.',
  ctaLabel = 'Shop Now',
  ctaHref = '/shop',
  enabled = true,
}) {
  const [visible, setVisible] = React.useState(false);
  const [revealedCount, setRevealedCount] = React.useState(0);
  const [unlocked, setUnlocked] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState('');

  const triggeredRef = React.useRef(false);
  const allRevealed = revealedCount >= prizes.length;

  const open = React.useCallback(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch {
      // ignore storage failures (private browsing, etc.)
    }
    setVisible(true);
  }, []);

  // Trigger wiring — exit-intent and the dwell timer race each other;
  // whichever fires first opens the card and cancels the other.
  React.useEffect(() => {
    if (!enabled) return;
    let alreadyShown = false;
    try {
      alreadyShown = window.sessionStorage.getItem(SESSION_KEY) === '1';
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return;

    const dwellTimer = setTimeout(open, DWELL_MS);

    const handleExitIntent = (e) => {
      if (e.clientY <= 0) open();
    };
    document.addEventListener('mouseleave', handleExitIntent);

    return () => {
      clearTimeout(dwellTimer);
      document.removeEventListener('mouseleave', handleExitIntent);
    };
  }, [enabled, open]);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!email.trim() || !email.includes('@')) {
      setFormError('Enter a valid email to unlock your reserve.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Enter a phone number to unlock your reserve.');
      return;
    }
    setSubmitting(true);
    try {
      await fetch('/api/checkout-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone,
          source: 'scratch-popup',
          status: 'subscribed',
          sessionId: getSessionId(),
          url: window.location.href,
        }),
      });
      setUnlocked(true);
    } catch {
      setFormError('Something went wrong — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => setVisible(false);

  if (!visible) return null;

  return (
    <div style={overlayStyle} onClick={close}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <button onClick={close} aria-label="Close" style={closeBtnStyle}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <line x1="2" y1="2" x2="14" y2="14" stroke={INK} strokeWidth="1" />
            <line x1="14" y1="2" x2="2" y2="14" stroke={INK} strokeWidth="1" />
          </svg>
        </button>

        <h2 style={headlineStyle}>{headline}</h2>
        <p style={subtextStyle}>{subtext}</p>

        <div className="reserve-scratch-grid" style={scratchGridStyle}>
          {prizes.map((prize) => (
            <ScratchPanel
              key={prize.code}
              label={prize.label}
              code={prize.code}
              unlocked={unlocked}
              onRevealed={() => setRevealedCount((n) => n + 1)}
            />
          ))}
        </div>

        {allRevealed && !unlocked && (
          <form onSubmit={handleUnlock} style={formStyle}>
            <p style={formLeadStyle}>Enter your email and phone to unlock these.</p>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="reserve-field"
              style={fieldStyle}
            />
            <input
              type="tel"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              className="reserve-field"
              style={fieldStyle}
            />
            {formError && <p style={formErrorStyle}>{formError}</p>}
            <button type="submit" disabled={submitting} className="reserve-cta" style={{ ...ctaStyle, width: '100%', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Unlocking…' : 'Unlock My Reserve'}
            </button>
          </form>
        )}

        {unlocked && (
          <>
            <p style={validityStyle}>{validityNote}</p>
            <a href={ctaHref} className="reserve-cta" style={ctaStyle}>{ctaLabel}</a>
          </>
        )}
      </div>

      <style jsx global>{`
        @keyframes reserve-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .reserve-cta:hover {
          opacity: 0.8;
        }
        .reserve-field:focus {
          border-color: rgba(22,20,15,0.5);
        }
      `}</style>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 1000,
  background: 'rgba(22,20,15,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
  animation: 'reserve-fade-in 300ms ease both',
};

const cardStyle = {
  position: 'relative',
  background: PAPER,
  color: INK,
  maxWidth: 380,
  width: '100%',
  padding: '40px 32px 32px',
  textAlign: 'center',
  fontFamily: "'Hanken Grotesk', sans-serif",
};

const closeBtnStyle = {
  position: 'absolute', top: 16, right: 16,
  background: 'none', border: 'none', padding: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const headlineStyle = {
  fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: 24,
  lineHeight: 1.3, margin: '0 0 10px',
};

const subtextStyle = {
  fontSize: 13, color: 'rgba(22,20,15,0.6)', margin: '0 0 28px', letterSpacing: '0.02em',
};

const scratchGridStyle = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
};

const panelWrapStyle = {
  position: 'relative', aspectRatio: '3 / 4', overflow: 'hidden',
};

const panelRevealStyle = {
  position: 'absolute', inset: 0,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 4, background: PAPER, padding: '0 4px',
};

const panelLabelStyle = {
  fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: 16, textAlign: 'center', lineHeight: 1.15,
};

const panelCodeStyle = {
  fontSize: 10, letterSpacing: '0.04em', color: 'rgba(22,20,15,0.6)', textAlign: 'center',
};

const panelCanvasStyle = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  cursor: 'pointer', touchAction: 'none',
};

const formStyle = {
  marginTop: 24, textAlign: 'left',
};

const formLeadStyle = {
  fontSize: 12, color: 'rgba(22,20,15,0.6)', margin: '0 0 12px', textAlign: 'center',
};

const fieldStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '12px 14px', marginBottom: 10,
  border: '1px solid rgba(22,20,15,0.25)', borderRadius: 3,
  background: 'transparent',
  fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 14, color: INK,
  outline: 'none',
};

const formErrorStyle = {
  fontSize: 12, color: '#a13d2b', margin: '0 0 12px', textAlign: 'center',
};

const validityStyle = {
  fontSize: 12, color: 'rgba(22,20,15,0.6)', margin: '18px 0 22px',
};

const ctaStyle = {
  display: 'inline-block',
  background: INK, color: PAPER,
  fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 12,
  letterSpacing: '0.14em', textTransform: 'uppercase',
  padding: '14px 32px', borderRadius: 3,
  textDecoration: 'none',
  transition: 'opacity 150ms ease',
};
