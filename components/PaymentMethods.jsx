import React from 'react';
import { T } from '../lib/theme';

// "Available at checkout" reassurance row — the payment methods a shopper
// will actually be offered, shown under the Add to bag button.
//
// This list is deliberately hand-kept in sync with what pages/checkout.jsx
// really wires up (Square's Web Payments SDK: Apple Pay, Google Pay,
// Afterpay, and the card element). Do not add a badge for a method that
// isn't in that file — a logo here is a promise to the shopper, and one
// they can't actually use at checkout is worse than showing nothing. Cash
// App Pay in particular was removed from checkout and must stay off this
// row unless it's wired back up.
//
// The note behind the (i) covers the honest caveat: the wallets are
// device- and browser-dependent (Apple Pay only appears in Safari, Afterpay
// only within its own order-value range), so each shopper sees the subset
// their device supports rather than all four.
//
// Marks are inline SVG rather than image files: no extra requests, no
// external hosts, and they stay sharp at any size.

const NOTE = 'Apple Pay, Google Pay and Afterpay appear at checkout when your device and browser support them. Cards are always accepted.';

export default function PaymentMethods() {
  const [noteOpen, setNoteOpen] = React.useState(false);

  return (
    <div style={wrap}>
      <div style={row}>
        <span style={label}>Available at checkout</span>
        <div style={marks}>
          <Mark title="Apple Pay"><ApplePayMark /></Mark>
          <Mark title="Google Pay"><GooglePayMark /></Mark>
          <Mark title="Afterpay"><AfterpayMark /></Mark>
          <Mark title="Credit or debit card"><CardMark /></Mark>
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            style={infoBtn}
            aria-label="About these payment methods"
            aria-expanded={noteOpen}
          >
            i
          </button>
        </div>
      </div>
      {noteOpen && <p style={note}>{NOTE}</p>}
    </div>
  );
}

function Mark({ title, children }) {
  return (
    <span style={markBox} title={title} role="img" aria-label={title}>
      {children}
    </span>
  );
}

function ApplePayMark() {
  return (
    <svg width="36" height="16" viewBox="0 0 36 16" fill="none" aria-hidden="true">
      <path
        d="M7.2 3.1c.4-.5.7-1.2.6-1.9-.6 0-1.3.4-1.7.9-.4.4-.7 1.1-.6 1.8.7.05 1.3-.35 1.7-.8Zm.6.9c-1 0-1.8.6-2.2.6-.5 0-1.2-.55-2-.54-1 .01-1.9.6-2.4 1.5-1 1.8-.3 4.4.7 5.9.5.7 1.1 1.5 1.9 1.5.7-.03 1-.5 1.9-.5s1.1.5 1.9.48c.8-.01 1.3-.7 1.8-1.4.6-.8.8-1.6.8-1.6s-1.6-.6-1.6-2.4c0-1.5 1.2-2.2 1.3-2.3-.7-1-1.8-1.2-2.2-1.2Z"
        fill="currentColor"
      />
      <text x="12.5" y="12" fontFamily="Hanken Grotesk, sans-serif" fontSize="10.5" fontWeight="600" fill="currentColor">Pay</text>
    </svg>
  );
}

function GooglePayMark() {
  return (
    <svg width="38" height="16" viewBox="0 0 38 16" fill="none" aria-hidden="true">
      {/* Google "G" in its four brand colors */}
      <path d="M9.6 8.15c0-.35-.03-.68-.09-1H5.9v1.9h2.08a1.78 1.78 0 0 1-.77 1.17v.97h1.25c.73-.67 1.15-1.66 1.15-2.84Z" fill="#4285F4" />
      <path d="M5.9 12c1.04 0 1.92-.34 2.56-.93l-1.25-.97c-.35.23-.79.37-1.31.37-1.01 0-1.86-.68-2.17-1.59H2.44v1c.63 1.26 1.94 2.12 3.46 2.12Z" fill="#34A853" />
      <path d="M3.73 7.88a2.4 2.4 0 0 1 0-1.53v-1H2.44a4 4 0 0 0 0 3.53l1.29-1Z" fill="#FBBC04" />
      <path d="M5.9 4.76c.57 0 1.08.2 1.48.58l1.11-1.11A3.93 3.93 0 0 0 5.9 3.2c-1.52 0-2.83.86-3.46 2.12l1.29 1c.31-.91 1.16-1.56 2.17-1.56Z" fill="#EA4335" />
      <text x="12" y="12" fontFamily="Hanken Grotesk, sans-serif" fontSize="10.5" fontWeight="600" fill="currentColor">Pay</text>
    </svg>
  );
}

function AfterpayMark() {
  return (
    <svg width="52" height="16" viewBox="0 0 52 16" fill="none" aria-hidden="true">
      <text x="0" y="12" fontFamily="Hanken Grotesk, sans-serif" fontSize="10.5" fontWeight="700" fill="currentColor">
        afterpay
      </text>
    </svg>
  );
}

function CardMark() {
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" aria-hidden="true">
      <rect x="0.6" y="1.6" width="22.8" height="12.8" rx="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M0.6 5.6h22.8" stroke="currentColor" strokeWidth="1.2" />
      <rect x="3" y="9" width="5" height="1.6" rx="0.8" fill="currentColor" />
    </svg>
  );
}

const wrap = { marginTop: 14 };
const row = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
  border: `1px solid ${T.line}`, borderRadius: 12, padding: '11px 14px', background: T.white,
};
const label = { fontFamily: T.sans, fontSize: 12, color: T.soft, whiteSpace: 'nowrap' };
const marks = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' };
const markBox = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  height: 26, padding: '0 8px', border: `1px solid ${T.line}`, borderRadius: 5,
  background: T.white, color: T.ink, flexShrink: 0,
};
const infoBtn = {
  width: 20, height: 20, borderRadius: '50%', border: `1px solid ${T.line}`,
  background: 'none', color: T.soft, cursor: 'pointer', flexShrink: 0,
  fontFamily: T.serif, fontSize: 11, fontStyle: 'italic', lineHeight: 1, padding: 0,
};
const note = { fontSize: 11, color: T.soft, lineHeight: 1.6, margin: '8px 2px 0' };
