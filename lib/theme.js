// VEIL design tokens — minimal black & white (Diptyque/Byredo)
export const T = {
  white: '#FCFBF7',
  paper: '#F4F2EC',
  ink: '#16140F',
  soft: '#8B8678',
  line: 'rgba(22,20,15,0.16)',
  dline: 'rgba(252,251,247,0.22)',
  maxw: '1200px',
  serif: "'Fraunces', serif",
  sans: "'Hanken Grotesk', sans-serif",
};

// Shared style fragments reused across pages
export const S = {
  label: {
    fontSize: 10, letterSpacing: '0.34em', textTransform: 'uppercase',
    color: T.soft, fontWeight: 500,
  },
  h2: {
    fontFamily: T.serif, fontWeight: 300,
    fontSize: 'clamp(30px,3.6vw,46px)', lineHeight: 1.1, letterSpacing: '0.005em',
    color: T.ink,
  },
  it: { fontFamily: T.serif, fontStyle: 'italic', fontWeight: 300 },
  btnFill: {
    display: 'inline-flex', alignItems: 'center', height: 48, padding: '0 30px',
    background: T.ink, color: T.white, border: 'none', cursor: 'pointer',
    fontFamily: T.sans, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
  },
  btnOutline: {
    display: 'inline-flex', alignItems: 'center', height: 48, padding: '0 30px',
    background: 'transparent', color: T.ink, border: `1px solid ${T.ink}`, cursor: 'pointer',
    fontFamily: T.sans, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
    transition: 'all .2s',
  },
  link: {
    fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase',
    borderBottom: `1px solid ${T.ink}`, paddingBottom: 5, cursor: 'pointer',
  },
  wrap: { maxWidth: T.maxw, margin: '0 auto', padding: '0 40px' },
};
