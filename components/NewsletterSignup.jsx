// Homepage newsletter signup. Same signup as the popup (lib/useSignup.js ->
// /api/email/signup): email AND mobile, both required. The email joins the
// marketing list and gets the welcome series; the mobile number is an SMS
// opt-in. The WELCOME10 code is then shown right here.

import React from 'react';
import Link from 'next/link';
import { T } from '../lib/theme';
import { useSignup } from '../lib/useSignup';
import SignupCode from './SignupCode';

// Kept word-for-word in sync with SMS_CONSENT_TEXT in lib/email/smsStore.js,
// which is what gets stored as the consent record.
const SMS_DISCLOSURE =
  'By entering your number, you agree to receive recurring automated marketing text messages from VEIL at this number. '
  + 'Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. '
  + 'Reply STOP to cancel, HELP for help.';

export default function NewsletterSignup() {
  const { email, setEmail, phone, setPhone, submitting, error, done, submit } = useSignup({ source: 'newsletter', leadName: 'Newsletter form' });

  if (done) {
    return (
      <div role="status" aria-live="polite">
        <p style={{ fontFamily: T.serif, fontWeight: 300, fontSize: 22, margin: '0 0 12px' }}>{done.already ? 'Welcome back.' : 'You are on the list.'}</p>
        <SignupCode done={done} center />
      </div>
    );
  }

  return (
    <>
      <form style={form} onSubmit={submit} aria-busy={submitting} noValidate>
        <div style={row}>
          <input type="email" placeholder="Email address" aria-label="Email address" style={input} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required maxLength={254} disabled={submitting} />
        </div>
        <div style={row}>
          <input type="tel" placeholder="Mobile number" aria-label="Mobile number" style={input} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel-national" inputMode="tel" required disabled={submitting} />
          <button type="submit" disabled={submitting} style={{ ...submitBtn, cursor: submitting ? 'wait' : 'pointer' }}>{submitting ? 'Sending…' : 'Reveal my code'}</button>
        </div>
      </form>
      <p role="alert" style={{ color: '#a13d2b', fontSize: 13, margin: '14px auto 0', maxWidth: '40ch' }}>{error}</p>
      <p style={legal}>
        {SMS_DISCLOSURE} See our <Link href="/terms" style={legalLink}>Terms</Link> and <Link href="/privacy" style={legalLink}>Privacy Policy</Link>.
      </p>
    </>
  );
}

const form = { display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420, margin: '0 auto' };
const row = { display: 'flex', borderBottom: `1px solid ${T.ink}` };
const input = { flex: 1, minWidth: 0, height: 48, border: 'none', background: 'transparent', color: T.ink, padding: '0 4px', fontSize: 14, fontFamily: T.sans, outline: 'none' };
const submitBtn = { background: 'none', border: 'none', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontFamily: T.sans, color: T.ink, whiteSpace: 'nowrap', padding: '0 4px' };
const legal = { fontSize: 10.5, lineHeight: 1.55, color: T.soft, maxWidth: 420, margin: '10px auto 0' };
const legalLink = { color: T.soft, textDecoration: 'underline' };
