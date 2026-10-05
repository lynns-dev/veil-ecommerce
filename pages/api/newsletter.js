const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }
  const raw = (process.env.NEXT_PUBLIC_EMAIL_APP_URL || 'https://email-delta-eight.vercel.app').trim();
  const base = (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const upstream = await fetch(`${base}/api/email/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data.ok !== true) {
      console.error('Newsletter signup failed', { status: upstream.status });
      return res.status(502).json({ error: 'We could not send your confirmation email. Please try again.' });
    }
    return res.status(200).json({ ok: true, alreadySubscribed: data.alreadySubscribed === true });
  } catch (err) {
    console.error('Newsletter signup unavailable', { name: err.name });
    return res.status(502).json({ error: 'We could not send your confirmation email. Please try again.' });
  } finally {
    clearTimeout(timeout);
  }
}
