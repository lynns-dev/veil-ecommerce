// Shared state + submit for the site's signup forms (components/SignupPopup.jsx
// and components/NewsletterSignup.jsx). Both collect an email AND a mobile
// number — both required — post to /api/email/signup, and then show the
// welcome code on screen instead of making the shopper go find it in their
// inbox (the welcome email still goes out with the same code).

import React from 'react';
import { rememberIdentity } from './identity';
import { fbTrack, generateEventId, refreshPixelIdentity } from './fbPixel';
import { useCart } from './useCart';

// Set once someone signs up through either form, so the popup stays away.
export const SIGNED_UP_KEY = 'veil-signup-done';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same rule as normalizeUsPhone in lib/email/smsStore.js, which is what the
// server enforces: 10 digits (an optional leading 1), not starting 0 or 1.
function isUsPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  return ten.length === 10 && !/^[01]/.test(ten);
}

function offerLabel(discount) {
  if (!discount) return '';
  return discount.type === 'percent' ? `${discount.value}% off` : `$${discount.value} off`;
}

// source: 'popup' | 'newsletter' — recorded on the subscriber and on the SMS
// consent record. leadName is the Meta Lead event's content_name.
export function useSignup({ source, leadName }) {
  const { appliedDiscount, applyDiscount } = useCart();
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState('');
  const [done, setDone] = React.useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    if (!cleanEmail || !cleanPhone) {
      setError('Enter both your email and mobile number to get your code.');
      return;
    }
    if (!EMAIL_RE.test(cleanEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!isUsPhone(cleanPhone)) {
      setError('Enter a valid US mobile number.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/email/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, phone: cleanPhone, source }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');

      try { window.localStorage.setItem(SIGNED_UP_KEY, '1'); } catch { /* best-effort */ }
      rememberIdentity({ email: cleanEmail, phone: cleanPhone });
      refreshPixelIdentity(process.env.NEXT_PUBLIC_META_PIXEL_ID);
      fbTrack('Lead', { content_name: leadName }, generateEventId());

      // Put the code on the cart so it comes off at checkout without the
      // shopper typing it — unless they already have a code applied, which is
      // left alone rather than swapped out from under them.
      const discount = data.discount || null;
      let applied = false;
      if (discount && !appliedDiscount) {
        const result = await applyDiscount(discount.code);
        applied = Boolean(result && result.valid);
      }

      setDone({
        code: discount ? discount.code : '',
        offer: offerLabel(discount),
        applied,
        already: data.alreadySubscribed === true,
        emailed: data.welcomeSent === true,
        sms: Boolean(data.smsSubscribed),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return { email, setEmail, phone, setPhone, submitting, error, done, submit };
}
