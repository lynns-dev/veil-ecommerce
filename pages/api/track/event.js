// Public, fire-and-forget funnel event tracking. Never throws in a way that
// would surface to the visitor — a lost analytics ping shouldn't affect
// their experience.

import { incrementEvent, logEvent, logVisitor } from '../../../lib/analyticsStore';
import { sendCapiEvent, getRequestUserData } from '../../../lib/metaCapi';
import { isExcludedTraffic } from '../../../lib/ipFilter';
import { recordJourneyStep, pageLabel, EVENT_LABELS } from '../../../lib/journeys';
import { fbcSetCookieHeader } from '../../../lib/metaClickId';

const ALLOWED = ['pageview', 'addtocart', 'checkout_start', 'checkout_payment'];
// Logged to the timestamped recent-events feed for the live-activity view.
// pageview is excluded — too high-volume to be useful there.
const LOGGED = ['addtocart', 'checkout_start'];

// Trims a client-supplied string to a sane length so a malformed/hostile
// payload can't bloat the stored visitor entry — same guard
// pages/api/track/heartbeat.js uses on its own fields.
function clip(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

// Maps our internal event names to Meta's standard event names for CAPI,
// paired with the browser Pixel call sharing the same eventId (see
// lib/useCart.js, pages/checkout.jsx) so Meta dedupes instead of
// double-counting.
const CAPI_EVENT_NAMES = { addtocart: 'AddToCart', checkout_start: 'InitiateCheckout' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { event, productName, eventId, contentId, contentIds, contents, value, url, sessionId, email, phone, source, campaign, path, visitSource, fbc } = req.body || {};

  // Re-issue the Meta click ID cookie from the server. The browser sends its
  // click ID on the first page view of a visit (pages/_app.jsx); setting the
  // same value back in a response header is what lets it outlive Safari's
  // 24-hour/7-day cap on cookies written by JavaScript, so it is still there
  // when the shopper comes back to buy — see lib/metaClickId.js.
  if (fbc) {
    const cookie = fbcSetCookieHeader(fbc, {
      hostname: req.headers.host,
      secure: String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() !== 'http',
    });
    if (cookie) res.setHeader('Set-Cookie', cookie);
  }
  if (ALLOWED.includes(event) && !isExcludedTraffic(req)) {
    try {
      await incrementEvent(event, sessionId);
      // Admin's Paths tab (lib/journeys.js): one step per page or funnel event.
      await recordJourneyStep(req, {
        sessionId,
        label: event === 'pageview' ? pageLabel(path) : EVENT_LABELS[event],
        source: event === 'pageview' ? clip(visitSource, 60) : null,
      });
      if (LOGGED.includes(event)) {
        await logEvent(event, {
          ...(productName ? { productName } : {}),
          ...(sessionId ? { sessionId } : {}),
        });
      }
      // One entry per visitor per day (see logVisitor's own dedup) into the
      // admin "past traffic" list — pageview is the highest-fidelity signal
      // for "this is a real visit," same reasoning DEDUPED_EVENTS in
      // lib/analyticsStore.js already gives it for the funnel counters.
      if (event === 'pageview' && sessionId) {
        const city = req.headers['x-vercel-ip-city'];
        const country = req.headers['x-vercel-ip-country'] || 'XX';
        await logVisitor({
          sessionId,
          source: clip(source, 80) || 'Direct',
          campaign: clip(campaign, 80),
          path: clip(path, 200),
          city: city ? decodeURIComponent(city) : null,
          country,
        });
      }

      const capiEventName = CAPI_EVENT_NAMES[event];
      if (capiEventName && eventId) {
        await sendCapiEvent({
          eventName: capiEventName,
          eventId,
          eventSourceUrl: url,
          // email/phone ride along whenever the shopper has already given
          // them (lib/identity.js remembers them across the visit), so an
          // AddToCart or InitiateCheckout later in a session carries the
          // same identifiers Purchase does instead of matching on cookies
          // alone. They're hashed in getRequestUserData before sending.
          userData: getRequestUserData(req, {
            email,
            phone,
            externalId: sessionId || undefined,
          }),
          customData: {
            currency: 'USD',
            value,
            content_ids: contentIds || (contentId ? [contentId] : undefined),
            content_type: 'product',
            contents,
          },
        });
      }
    } catch (err) {
      console.error('Event tracking failed:', err);
    }
  }

  return res.status(204).end();
}
