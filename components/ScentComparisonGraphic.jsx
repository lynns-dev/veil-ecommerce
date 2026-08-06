import React from 'react';
import { T, S } from '../lib/theme';

// Animated "scent over a day" line chart — spray perfume's spike-then-crash
// vs. VEIL's steady hold, plus a plain-language skin-effect callout under
// each. Pure inline SVG + SMIL animation (<animate>/<animateMotion>), no
// canvas or animation library — consistent with the rest of the site
// (see Marquee.jsx's CSS-keyframe loop for the same "no new dependency"
// approach). Every claim here is one already made elsewhere on the site:
// the fade/spike framing matches pages/switch-to-veil.jsx's "why perfume
// fades" section (alcohol as a volatile carrier), and the ingredient/skin
// claims match the product page's own INGREDIENTS/BENEFITS copy
// (talc-free, vegan-friendly, pressed in rather than sprayed).
//
// The two curves and the moving time-cursor share one animation duration
// so they stay in lockstep — a dot sweeps along each line while a vertical
// guide sweeps the same pace behind them, then all three snap back to the
// morning and loop.

const CHART_W = 400;
const CHART_H = 150;
const DUR = '7s';
const HOURS = ['8 AM', '12 PM', '4 PM', '8 PM'];

// Hand-placed points rather than computed from data — this is an
// illustrative "shape of the day," not a plotted dataset with real units.
const SPRAY_PATH = 'M20,62 L80,26 L140,74 L200,104 L260,122 L320,130 L380,135';
const VEIL_PATH = 'M20,74 L80,65.6 L140,63.2 L200,64.4 L260,68 L320,70.4 L380,74';

export default function ScentComparisonGraphic() {
  return (
    <div style={wrap}>
      <p style={S.label}>Same day, two different stories</p>
      <h3 style={heading}>Spray Perfume vs. <span style={S.it}>VEIL.</span></h3>

      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: 'auto', marginTop: 20 }} role="img" aria-label="Chart comparing scent intensity over a day for spray perfume, which spikes then fades quickly, versus VEIL, which holds steady all day">
        <line x1="20" y1="140" x2="380" y2="140" stroke={T.line} strokeWidth="1" />

        {/* time-cursor, sweeping in sync with the two dots below */}
        <line x1="20" y1="8" x2="20" y2="140" stroke={T.line} strokeWidth="1" strokeDasharray="3 4">
          <animate attributeName="x1" values="20;380" dur={DUR} repeatCount="indefinite" />
          <animate attributeName="x2" values="20;380" dur={DUR} repeatCount="indefinite" />
        </line>

        <path d={SPRAY_PATH} fill="none" stroke={T.soft} strokeWidth="2" />
        <path d={VEIL_PATH} fill="none" stroke={T.ink} strokeWidth="2.5" />

        <circle r="4.5" fill={T.soft}>
          <animateMotion dur={DUR} repeatCount="indefinite" path={SPRAY_PATH} />
        </circle>
        <circle r="4.5" fill={T.ink}>
          <animateMotion dur={DUR} repeatCount="indefinite" path={VEIL_PATH} />
        </circle>
      </svg>

      <div style={hourRow}>
        {HOURS.map((h) => <span key={h}>{h}</span>)}
      </div>

      <div className="scent-compare-legend" style={legendRow}>
        <div style={legendItem}>
          <div style={legendHead}>
            <span style={{ ...dot, background: T.soft }} />
            <span style={legendTitle}>Spray perfume</span>
          </div>
          <p style={legendText}>Alcohol carries the scent, then evaporates within minutes — loud right after applying, faded by early afternoon. Alcohol can also dry out skin with daily use.</p>
        </div>
        <div style={legendItem}>
          <div style={legendHead}>
            <span style={{ ...dot, background: T.ink }} />
            <span style={legendTitle}>VEIL</span>
          </div>
          <p style={legendText}>Pressed into skin, not sprayed into air — no alcohol carrier to evaporate off. Talc-free, vegan-friendly powder, gentle enough to wear every day.</p>
        </div>
      </div>

      <style jsx>{`
        .scent-compare-legend { grid-template-columns: 1fr 1fr; }
        @media (max-width: 420px) {
          .scent-compare-legend { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

const wrap = { border: `1px solid ${T.line}`, background: T.paper, padding: '22px 20px 24px', marginBottom: 24 };
const heading = { fontFamily: T.serif, fontWeight: 300, fontSize: 20, margin: '6px 0 0' };
const hourRow = {
  display: 'flex', justifyContent: 'space-between', marginTop: 8,
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.soft,
};
const legendRow = { display: 'grid', gap: 20, marginTop: 22, paddingTop: 20, borderTop: `1px solid ${T.line}` };
const legendItem = {};
const legendHead = { display: 'flex', alignItems: 'center', gap: 8 };
const dot = { width: 9, height: 9, borderRadius: '50%', flexShrink: 0, display: 'inline-block' };
const legendTitle = { fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink, fontWeight: 500 };
const legendText = { fontSize: 13, color: T.soft, lineHeight: 1.55, margin: '8px 0 0' };
