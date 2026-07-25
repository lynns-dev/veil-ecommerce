// Persists QuickBooks OAuth tokens in a Redis-compatible KV store (Vercel KV
// or Upstash Redis both speak this same REST API) so the access token can be
// refreshed automatically across serverless invocations, with no manual
// rotation. Set KV_REST_API_URL / KV_REST_API_TOKEN to enable this.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
// Keyed by environment so a sandbox OAuth connection (for testing) can
// never overwrite the live production refresh token, or vice versa — both
// used to share a single fixed 'qb:tokens' key, meaning connecting a
// sandbox company via /api/qb-auth/connect while QB_ENVIRONMENT=sandbox
// would have clobbered the real production connection.
const LEGACY_KEY = 'qb:tokens';
const KEY = `qb:tokens:${process.env.QB_ENVIRONMENT === 'production' ? 'production' : 'sandbox'}`;

function assertConfigured() {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error(
      'KV_REST_API_URL / KV_REST_API_TOKEN are not set — connect a KV store (Vercel KV or Upstash Redis) so QuickBooks tokens can persist between requests.'
    );
  }
}

async function getRaw(key) {
  const res = await fetch(`${KV_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  const data = await res.json();
  return data.result ? JSON.parse(data.result) : null;
}

// One-time migration: the live production token was stored under the old
// fixed key before this environment-scoped split existed. Rather than
// requiring a manual re-connect the moment this deploys (which would break
// every real charge until someone noticed and visited /api/qb-auth/connect
// again), fall back to the legacy key on a miss and copy it forward — only
// relevant for the production environment, since sandbox never had tokens
// under the legacy key.
export async function getTokens() {
  assertConfigured();
  const current = await getRaw(KEY);
  if (current) return current;
  if (process.env.QB_ENVIRONMENT === 'production') {
    const legacy = await getRaw(LEGACY_KEY);
    if (legacy) {
      await setTokens(legacy);
      return legacy;
    }
  }
  return null;
}

export async function setTokens(tokens) {
  assertConfigured();
  const res = await fetch(`${KV_URL}/set/${KEY}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
    body: JSON.stringify(tokens),
  });
  if (!res.ok) {
    throw new Error('Failed to persist QuickBooks tokens to the KV store.');
  }
}
