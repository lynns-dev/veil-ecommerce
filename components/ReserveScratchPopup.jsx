import React from 'react';

// "Reveal Your Reserve" — a quiet, single-shot scratch-off card, not a
// gamified wheel. Self-contained: the discount code (and everything else
// campaign-specific) comes in as props so this can be reused/swapped
// without touching the interaction or drawing logic below.
//
// Trigger: exit-intent (cursor leaving toward the top of the viewport) OR
// a dwell timer, whichever comes first — never on load. sessionStorage
// keeps it to once per session; closing early or letting it reveal both
// count as "shown," so it won't reappear later in the same session either way.

const INK = '#16140F';
const PAPER = '#FAF8F4';
const SESSION_KEY = 'veil-reserve-shown';
const DWELL_MS = 15000;
const CLEAR_THRESHOLD = 0.6;
const SCRATCH_RADIUS = 22;

// A faint line-illustration puff — an outlined circle with a small ribbon
// knot, not a literal product photo. Drawn at low opacity straight onto
// the scratch layer so it reads as "something is under here" without ever
// being a distraction once revealed.
function drawScratchLayer(ctx, width, height) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = PAPER;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1.4;

  const cx = width / 2;
  const cy = height / 2 - 6;
  const r = Math.min(width, height) * 0.22;

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Small ribbon knot beneath the circle
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy + r + 6);
  ctx.lineTo(cx, cy + r + 16);
  ctx.lineTo(cx + 10, cy + r + 6);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

export default function ReserveScratchPopup({
  discountCode = 'RESERVED15',
  headline = 'Some things are worth uncovering slowly.',
  subtext = 'A private offer, reserved for you.',
  validityNote = 'Valid for 48 hours — because good things don’t wait forever.',
  ctaLabel = 'Shop Now',
  ctaHref = '/shop',
  enabled = true,
}) {
  const [visible, setVisible] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const [fadingCanvas, setFadingCanvas] = React.useState(false);
  const [canvasGone, setCanvasGone] = React.useState(false);

  const canvasRef = React.useRef(null);
  const scratchZoneRef = React.useRef(null);
  const scratchingRef = React.useRef(false);
  const revealedRef = React.useRef(false);
  const triggeredRef = React.useRef(false);

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

  // Canvas setup — runs once the card actually mounts (visible === true).
  React.useEffect(() => {
    if (!visible) return;
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
        setRevealed(true);
        setFadingCanvas(true);
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
  }, [visible]);

  // Once 60% is cleared, let the fade transition actually play (400ms)
  // before removing the canvas from the layout entirely.
  React.useEffect(() => {
    if (!fadingCanvas) return;
    const t = setTimeout(() => setCanvasGone(true), 400);
    return () => clearTimeout(t);
  }, [fadingCanvas]);

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

        <div ref={scratchZoneRef} style={scratchZoneStyle} className="reserve-scratch-zone">
          <div style={revealContentStyle}>
            <div style={codeStyle}>{discountCode}</div>
          </div>
          {!canvasGone && (
            <canvas
              ref={canvasRef}
              style={{
                ...canvasStyle,
                opacity: fadingCanvas ? 0 : 1,
                transition: 'opacity 400ms ease',
              }}
            />
          )}
        </div>

        {revealed && (
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
        .reserve-scratch-zone {
          width: 280px;
          height: 160px;
        }
        .reserve-cta:hover {
          opacity: 0.8;
        }
        @media (max-width: 420px) {
          .reserve-scratch-zone {
            width: 88vw;
            height: calc(88vw * 160 / 280);
          }
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

const scratchZoneStyle = {
  position: 'relative', margin: '0 auto', overflow: 'hidden',
};

const revealContentStyle = {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: PAPER,
};

const codeStyle = {
  fontFamily: "'Fraunces', serif", fontWeight: 300, fontSize: 30, letterSpacing: '0.04em',
};

const canvasStyle = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  cursor: 'pointer', touchAction: 'none',
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
