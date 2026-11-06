// Public, fire-and-forget split-test tracking (lib/experiments.js): a
// visitor saw a test ({ id, variant }), or reached a step while in tests
// ({ step, exps }).
import { recordExposure, recordExperimentStep } from '../../../lib/experimentsStore';
import { visitorIdFrom } from '../../../lib/journeys';
import { isExcludedTraffic } from '../../../lib/ipFilter';

const ID_RE = /^[A-Za-z0-9_-]{6,100}$/;
const STEPS = ['added', 'checkout_view', 'purchased'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }
  const { id, variant, step, exps, subtotal, sessionId } = req.body || {};
  const who = [visitorIdFrom(req), sessionId].find((v) => typeof v === 'string' && ID_RE.test(v));
  if (!who || isExcludedTraffic(req)) return res.status(204).end();
  try {
    if (typeof step === 'string' && STEPS.includes(step)) {
      await recordExperimentStep(exps, step, who, { subtotal: Number(subtotal) || 0 });
    } else if (typeof id === 'string' && typeof variant === 'string') {
      await recordExposure(id.slice(0, 40), variant.slice(0, 20), who);
    }
  } catch (err) {
    console.error('Experiment tracking failed:', err.message);
  }
  return res.status(204).end();
}
