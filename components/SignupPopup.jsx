import React from 'react';
import Link from 'next/link';
import { T } from '../lib/theme';
import { useSignup, SIGNED_UP_KEY } from '../lib/useSignup';
import SignupCode from './SignupCode';

// Site signup popup: email AND mobile, both required, posting to
// /api/email/signup through lib/useSignup.js (email -> the marketing list
// with the WELCOME10 welcome email; mobile -> an SMS opt-in with its consent
// record, lib/email/smsStore.js). Once they submit, the code is shown right
// here (components/SignupCode.jsx) and applied to their cart.
//
// Trigger: a dwell timer or exit intent (cursor leaving toward the top of
// the viewport), whichever comes first — never on load. Once someone signs
// up it never shows again on that device; closing it hides it for
// DISMISS_DAYS. Both are best-effort localStorage — blocked storage just
// means it can show again next visit.

const DISMISSED_KEY = 'veil-signup-dismissed-at';
const DISMISS_DAYS = 7;
const DWELL_MS = 10000;
const IMAGE = '/images/veil-signup-popup.webp';

// Kept word-for-word in sync with SMS_CONSENT_TEXT in lib/email/smsStore.js,
// which is what gets stored as the consent record.
const SMS_DISCLOSURE =
  'By entering your number, you agree to receive recurring automated marketing text messages from VEIL at this number. '
  + 'Consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. '
  + 'Reply STOP to cancel, HELP for help.';

function storageGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* best-effort */ }
}

function shouldShow() {
  if (storageGet(SIGNED_UP_KEY)) return false;
  const dismissedAt = Number(storageGet(DISMISSED_KEY)) || 0;
  return Date.now() - dismissedAt > DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function SignupPopup({ enabled = true }) {
  const [open, setOpen] = React.useState(false);
  const { email, setEmail, phone, setPhone, submitting, error, done, submit } = useSignup({ source: 'popup', leadName: 'Signup popup' });

  React.useEffect(() => {
    if (!enabled || !shouldShow()) return undefined;
    let fired = false;
    const show = () => {
      // Re-checked here, not just on mount: they may have signed up through
      // the on-page newsletter form while the dwell timer was running.
      if (fired || !shouldShow()) return;
      fired = true;
      setOpen(true);
    };
    const timer = setTimeout(show, DWELL_MS);
    const onLeave = (e) => { if (e.clientY <= 0) show(); };
    document.addEventListener('mouseleave', onLeave);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled]);

  const close = () => {
    if (!done) storageSet(DISMISSED_KEY, String(Date.now()));
    setOpen(false);
  };

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, done]);

  if (!open) return null;

  return (
    <div className="signup-overlay" onClick={close} role="presentation">
      <div className="signup-card" role="dialog" aria-modal="true" aria-label="Join VEIL" onClick={(e) => e.stopPropagation()}>
        <div className="signup-image">
          <img src={IMAGE} alt="The VEIL puff" />
        </div>
        <div className="signup-body">
          <div className="signup-head">
            <img src="/images/veil-logo-black.png" alt="VEIL" className="signup-logo" />
            <button type="button" onClick={close} aria-label="Close" className="signup-close">&times;</button>
          </div>

          {done ? (
            <div style={{ marginTop: 28 }}>
              <p className="signup-lede" style={{ marginBottom: 14 }}>{done.already ? 'Welcome back.' : "You're in."}</p>
              <SignupCode done={done} />
              <button type="button" onClick={close} className="signup-submit" style={{ marginTop: 28 }}>Keep shopping</button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <p className="signup-lede">Join the VEIL list. Enter your email and mobile number to reveal your 10% off code.</p>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                aria-label="Email address"
                autoComplete="email"
                required
                className="signup-input"
                style={{ marginTop: 28 }}
              />

              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <div className="signup-input signup-cc" aria-label="Country code">+1</div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile Number"
                  aria-label="Mobile number"
                  required
                  autoComplete="tel-national"
                  inputMode="tel"
                  className="signup-input"
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>

              {error && <p role="alert" style={{ color: '#a13d2b', fontSize: 13, marginTop: 12 }}>{error}</p>}

              <button type="submit" disabled={submitting} className="signup-submit" style={{ marginTop: 22, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Signing up…' : 'Reveal My Code'}
              </button>

              <p className="signup-legal">
                {SMS_DISCLOSURE} See our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
              </p>
            </form>
          )}
        </div>
      </div>

      <style jsx>{`
        .signup-overlay {
          position: fixed; inset: 0; z-index: 1000; background: rgba(22, 20, 15, 0.45);
          display: flex; align-items: center; justify-content: center; padding: 16px;
        }
        .signup-card {
          display: flex; width: 100%; max-width: 900px; max-height: calc(100vh - 32px);
          background: ${T.white}; overflow: hidden; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
        }
        .signup-image { flex: 1 1 50%; min-width: 0; background: ${T.paper}; }
        .signup-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .signup-body { flex: 1 1 50%; min-width: 0; padding: 32px 40px 28px; overflow-y: auto; color: ${T.ink}; }
        .signup-head { position: relative; display: flex; justify-content: center; align-items: center; }
        .signup-logo { height: 30px; width: auto; }
        .signup-close {
          position: absolute; right: -8px; top: 50%; transform: translateY(-50%);
          border: none; background: none; font-size: 34px; line-height: 1; cursor: pointer; color: ${T.ink}; padding: 4px 8px;
        }
        .signup-lede { font-family: ${T.serif}; font-weight: 300; font-size: 24px; line-height: 1.4; margin: 28px 0 0; }
        .signup-input {
          height: 56px; padding: 0 18px; border: 1px solid #9a968d; background: ${T.white}; color: ${T.ink};
          font-family: ${T.sans}; font-size: 16px; width: 100%; box-sizing: border-box; outline: none; border-radius: 0;
        }
        .signup-input:focus { border-color: ${T.ink}; }
        .signup-cc { width: 84px; flex-shrink: 0; display: flex; align-items: center; font-size: 17px; }
        .signup-submit {
          width: 100%; height: 56px; border: none; background: ${T.ink}; color: ${T.white};
          font-family: ${T.sans}; font-size: 17px; cursor: pointer;
        }
        .signup-legal { font-size: 10.5px; line-height: 1.55; color: ${T.soft}; margin: 14px 0 0; }
        .signup-legal :global(a) { color: ${T.soft}; text-decoration: underline; }
        @media (max-width: 760px) {
          .signup-card { flex-direction: column; max-width: 440px; }
          .signup-image { flex: 0 0 auto; height: 170px; }
          .signup-image img { object-position: center 35%; }
          .signup-body { padding: 22px 22px 20px; }
          .signup-lede { font-size: 20px; margin-top: 20px; }
          .signup-input, .signup-submit { height: 50px; }
        }
      `}</style>
    </div>
  );
}
