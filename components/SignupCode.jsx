// The welcome code, shown on screen right after signup (see lib/useSignup.js)
// with a copy button. `done` is the hook's result object.

import React from 'react';
import { T } from '../lib/theme';

export default function SignupCode({ done, center = false }) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(done.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (older in-app browsers): the code is on screen to
      // type or long-press instead.
    }
  };

  // No code came back (it was removed from /admin's Discounts tab): fall back
  // to the inbox when a welcome email actually went out, and otherwise promise
  // nothing beyond the signup itself.
  if (!done.code) {
    return (
      <p style={note}>
        {done.emailed ? 'Check your inbox — your welcome offer is on its way.' : "You're on the list."}
      </p>
    );
  }

  return (
    <div style={{ textAlign: center ? 'center' : 'left' }}>
      <p style={note}>Here&rsquo;s your {done.offer} code:</p>
      <div style={{ ...box, margin: center ? '14px auto 0' : '14px 0 0' }}>
        <span style={codeText} data-testid="signup-code">{done.code}</span>
        <button type="button" onClick={copy} style={copyBtn} aria-label={`Copy code ${done.code}`}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p style={{ ...note, marginTop: 14 }}>
        {done.applied ? 'It’s already applied to your cart and comes off at checkout.' : 'Enter it at checkout.'}
        {done.emailed && ' We’ve emailed it to you too.'}
      </p>
    </div>
  );
}

const note = { fontSize: 15, lineHeight: 1.6, color: T.soft, margin: 0 };
const box = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
  maxWidth: 420, padding: '14px 18px', border: `1px dashed ${T.ink}`, background: T.paper,
};
const codeText = { fontFamily: T.sans, fontWeight: 600, fontSize: 20, letterSpacing: '0.16em', color: T.ink };
const copyBtn = {
  border: 'none', background: 'none', cursor: 'pointer', color: T.ink, padding: '4px 0',
  fontFamily: T.sans, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'underline', textUnderlineOffset: 4,
};
