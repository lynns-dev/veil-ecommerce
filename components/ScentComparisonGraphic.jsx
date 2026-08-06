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
//
// compact: a shorter, tighter build for spots where scroll real estate
// matters (currently pages/product/[id].jsx, below Subscribe & Payment
// rather than the full-size default used on pages/scent.jsx) — same
// chart, less chrome around it.

const CHART_W = 400;
const DUR = '7s';
const HOURS = ['8 AM', '12 PM', '4 PM', '8 PM'];

// Illustrative "shape of the day" (0-100), not a plotted dataset with real
// units — kept as plain numbers and turned into an SVG path at render time
// so the curve can be redrawn at whatever chart height compact mode needs
// without hand-recalculating coordinates.
const SPRAY_DATA = [65, 95, 55, 30, 15, 8, 4];
const VEIL_DATA = [55, 62, 64, 63, 60, 58, 55];
const PAD = { l: 20, r: 20, t: 8, b: 10 };

function buildPath(data, w, h) {
  const plotW = w - PAD.l - PAD.r;
  const plotH = h - PAD.t - PAD.b;
  const baseline = h - PAD.b;
  return data
    .map((v, i) => {
      const x = PAD.l + (i * plotW) / (data.length - 1);
      const y = baseline - (v / 100) * plotH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function ScentComparisonGraphic({ compact = false }) {
  const chartH = compact ? 88 : 150;
  const baseline = chartH - PAD.b;
  const sprayPath = React.useMemo(() => buildPath(SPRAY_DATA, CHART_W, chartH), [chartH]);
  const veilPath = React.useMemo(() => buildPath(VEIL_DATA, CHART_W, chartH), [chartH]);

  return (
    <div style={compact ? wrapCompact : wrap}>
      {!compact && <p style={S.label}>Same day, two different stories</p>}
      <h3 style={compact ? headingCompact : heading}>Spray Perfume vs. <span style={S.it}>VEIL.</span></h3>

      <svg viewBox={`0 0 ${CHART_W} ${chartH}`} style={{ width: '100%', height: 'auto', marginTop: compact ? 10 : 20, display: 'block' }} role="img" aria-label="Chart comparing scent intensity over a day for spray perfume, which spikes then fades quickly, versus VEIL, which holds steady all day">
        <line x1={PAD.l} y1={baseline} x2={CHART_W - PAD.r} y2={baseline} stroke={T.line} strokeWidth="1" />

        {/* time-cursor, sweeping in sync with the two dots below */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={baseline} stroke={T.line} strokeWidth="1" strokeDasharray="3 4">
          <animate attributeName="x1" values={`${PAD.l};${CHART_W - PAD.r}`} dur={DUR} repeatCount="indefinite" />
          <animate attributeName="x2" values={`${PAD.l};${CHART_W - PAD.r}`} dur={DUR} repeatCount="indefinite" />
        </line>

        <path d={sprayPath} fill="none" stroke={T.soft} strokeWidth="2" />
        <path d={veilPath} fill="none" stroke={T.ink} strokeWidth="2.5" />

        <circle r={compact ? 3.5 : 4.5} fill={T.soft}>
          <animateMotion dur={DUR} repeatCount="indefinite" path={sprayPath} />
        </circle>
        <circle r={compact ? 3.5 : 4.5} fill={T.ink}>
          <animateMotion dur={DUR} repeatCount="indefinite" path={veilPath} />
        </circle>
      </svg>

      {!compact && (
        <div style={hourRow}>
          {HOURS.map((h) => <span key={h}>{h}</span>)}
        </div>
      )}

      <div className="scent-compare-legend" style={compact ? legendRowCompact : legendRow}>
        <div>
          <div style={legendHead}>
            <span style={{ ...dot, background: T.soft }} />
            <span style={compact ? legendTitleCompact : legendTitle}>Spray perfume</span>
          </div>
          {compact ? (
            <p style={legendTextCompact}>Evaporates in minutes — can dry skin with daily use.</p>
          ) : (
            <p style={legendText}>Alcohol carries the scent, then evaporates within minutes — loud right after applying, faded by early afternoon. Alcohol can also dry out skin with daily use.</p>
          )}
        </div>
        <div>
          <div style={legendHead}>
            <span style={{ ...dot, background: T.ink }} />
            <span style={compact ? legendTitleCompact : legendTitle}>VEIL</span>
          </div>
          {compact ? (
            <p style={legendTextCompact}>Pressed into skin — talc-free, gentle for every day.</p>
          ) : (
            <p style={legendText}>Pressed into skin, not sprayed into air — no alcohol carrier to evaporate off. Talc-free, vegan-friendly powder, gentle enough to wear every day.</p>
          )}
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
const wrapCompact = { border: `1px solid ${T.line}`, background: T.paper, padding: '14px 16px 16px', marginBottom: 28 };
const heading = { fontFamily: T.serif, fontWeight: 300, fontSize: 20, margin: '6px 0 0' };
const headingCompact = { fontFamily: T.serif, fontWeight: 300, fontSize: 15, margin: 0 };
const hourRow = {
  display: 'flex', justifyContent: 'space-between', marginTop: 8,
  fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.soft,
};
const legendRow = { display: 'grid', gap: 20, marginTop: 22, paddingTop: 20, borderTop: `1px solid ${T.line}` };
const legendRowCompact = { display: 'grid', gap: 12, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` };
const legendHead = { display: 'flex', alignItems: 'center', gap: 8 };
const dot = { width: 9, height: 9, borderRadius: '50%', flexShrink: 0, display: 'inline-block' };
const legendTitle = { fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink, fontWeight: 500 };
const legendTitleCompact = { fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.ink, fontWeight: 500 };
const legendText = { fontSize: 13, color: T.soft, lineHeight: 1.55, margin: '8px 0 0' };
const legendTextCompact = { fontSize: 11.5, color: T.soft, lineHeight: 1.4, margin: '5px 0 0' };
