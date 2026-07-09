import React from 'react';

const fillStyle = { width: '100%', height: '100%', display: 'block', objectFit: 'cover', transition: 'opacity 0.6s ease' };

// Renders real product photography when available, falling back to a CSS/SVG
// stand-in (a VEIL tin, an inverted tin, or a puff) for products without one.
// When a second image is supplied, auto-cycles between the two (used on
// collection/grid cards, not the single-image product detail view).
export default function ProductVisual({ id = 'original', width = 150, image, image2, alt }) {
  const [showSecond, setShowSecond] = React.useState(false);

  React.useEffect(() => {
    if (!image2) return;
    const iv = setInterval(() => setShowSecond((s) => !s), 2500);
    return () => clearInterval(iv);
  }, [image2]);

  if (image) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <img src={image} alt={alt || id} style={{ ...fillStyle, opacity: showSecond ? 0 : 1 }} />
        {image2 && (
          <img
            src={image2}
            alt={alt || id}
            style={{ ...fillStyle, position: 'absolute', top: 0, left: 0, opacity: showSecond ? 1 : 0 }}
          />
        )}
      </div>
    );
  }
  if (id === 'puff' || id === 'ritual-set') {
    return (
      <svg width={width} viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="110" cy="110" r="82" fill="none" stroke="#16140F" strokeWidth="2" />
        <path d="M110 108 q-30 -18 -40 6 q-4 16 16 12 q16 -4 24 -18Z" fill="none" stroke="#16140F" strokeWidth="1.6" />
        <path d="M110 108 q30 -18 40 6 q4 16 -16 12 q-16 -4 -24 -18Z" fill="none" stroke="#16140F" strokeWidth="1.6" />
      </svg>
    );
  }
  const inverted = id === 'citron';
  const jarFill = inverted ? '#FCFBF7' : '#16140F';
  const jarStroke = inverted ? '#16140F' : 'none';
  const labelFill = inverted ? '#16140F' : '#FCFBF7';
  const textFill = inverted ? '#FCFBF7' : '#16140F';
  const label = id === 'citron' ? 'CITRON' : 'VEIL';
  const fontSize = id === 'citron' ? 17 : 30;
  return (
    <svg width={width} viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"
      style={{ filter: 'drop-shadow(0 22px 34px rgba(22,20,15,.12))' }}>
      <rect x="42" y="78" width="156" height="196" rx="8" fill={jarFill} stroke={jarStroke} strokeWidth="2" />
      <rect x="42" y="52" width="156" height="46" rx="10" fill={jarFill} stroke={jarStroke} strokeWidth="2" />
      <ellipse cx="120" cy="52" rx="78" ry="12" fill={jarFill} stroke={jarStroke} strokeWidth="2" />
      <rect x="66" y="122" width="108" height="124" rx="1" fill={labelFill} />
      <text x="120" y="196" textAnchor="middle" fontFamily="Fraunces, serif" fontSize={fontSize} letterSpacing="5" fill={textFill}>{label}</text>
    </svg>
  );
}
