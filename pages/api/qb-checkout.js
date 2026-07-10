// Charges a QuickBooks Payments card token via the Payments API.
//
// The access token is fetched from lib/qbServerAuth.js, which transparently
// refreshes it (using a refresh token persisted in the KV store) whenever
// it's close to expiring. Connect the QuickBooks account once via
// /api/qb-auth/connect — after that this route needs no manual token
// rotation.

import { getValidAccessToken } from '../../lib/qbServerAuth';

const API_BASE = {
  sandbox: 'https://sandbox.api.intuit.com',
  production: 'https://api.intuit.com',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const environment = process.env.QB_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

  let accessToken;
  try {
    accessToken = await getValidAccessToken();
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  try {
    const { token, amount, items } = req.body;

    if (!token) return res.status(400).json({ error: 'Missing card token' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (!items || items.length === 0) return res.status(400).json({ error: 'No items in cart' });

    const response = await fetch(`${API_BASE[environment]}/quickbooks/v4/payments/charges`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Request-Id': `veil-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      },
      body: JSON.stringify({
        amount: Number(amount).toFixed(2),
        currency: 'USD',
        token,
        capture: true,
        context: { mobile: false, isEcommerce: true },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.errors?.[0]?.detail || data?.error?.message || 'Charge failed';
      return res.status(response.status).json({ error: message });
    }

    return res.status(200).json({ id: data.id, status: data.status });
  } catch (error) {
    console.error('QuickBooks Payments error:', error);
    return res.status(500).json({ error: error.message });
  }
}
