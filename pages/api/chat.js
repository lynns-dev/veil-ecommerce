// Browsing-assistant chat endpoint (components/ShopAssistant.jsx).
//
// The Anthropic key stays server-side — the browser only ever posts a
// transcript and gets text back. Everything the assistant is allowed to say
// (product facts, and critically the one real promo code) is assembled here
// in lib/shopAssistant.js rather than sent up from the client, so a crafted
// request can't talk the assistant into offering a discount that doesn't
// exist.
//
// Caps are deliberate and cheap to reason about: this endpoint is public
// and unauthenticated, so an open-ended one would be a standing invitation
// to run up an API bill.

import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, resolvePromo } from '../../lib/shopAssistant';

const MAX_MESSAGES = 24;        // ~12 exchanges before we ask them to email
const MAX_CHARS_PER_MESSAGE = 1000;
const MAX_TOTAL_CHARS = 12000;

// effort: 'low' — this is a short, conversational, latency-sensitive task,
// exactly what the low end is for. Thinking is left on (the Opus 5 default):
// disabling it is the more expensive lever and brings its own failure modes,
// while low effort already keeps the spend and the wait down.
const MODEL = 'claude-opus-5';
const EFFORT = 'low';
// Caps thinking + reply together. Generous enough that a reply is never cut
// mid-sentence, while the brevity instruction in the system prompt does the
// actual work of keeping answers short.
const MAX_TOKENS = 2048;

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set.');
  client = new Anthropic();
  return client;
}

// Accepts only the shape we expect — role plus a plain string — so nothing
// from the client can smuggle in extra content blocks or a system turn.
function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const messages = [];
  for (const m of raw.slice(-MAX_MESSAGES)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
    if (typeof m.content !== 'string') return null;
    const content = m.content.trim().slice(0, MAX_CHARS_PER_MESSAGE);
    if (content) messages.push({ role: m.role, content });
  }
  if (messages.length === 0) return null;
  // Claude requires the first turn to be the user's.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (messages.length === 0) return null;
  const total = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (total > MAX_TOTAL_CHARS) return null;
  return messages;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) return res.status(400).json({ error: 'Invalid conversation.' });

  try {
    const promo = await resolvePromo();
    const system = buildSystemPrompt(promo);

    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: EFFORT },
      // The system prompt is identical on every request, so caching it turns
      // the catalog + rules into a cache read after the first call.
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
    });

    // Safety classifiers can decline with a normal 200 — check before
    // reading content, which is empty or partial in that case.
    if (response.stop_reason === 'refusal') {
      return res.status(200).json({
        reply: 'I can’t help with that one, but I’m happy to talk through the scents or anything about your order.',
      });
    }

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();

    if (!reply) return res.status(502).json({ error: 'Empty response.' });
    return res.status(200).json({ reply });
  } catch (err) {
    // Typed SDK errors, so a rate limit reads differently from a bad key.
    if (err instanceof Anthropic.RateLimitError) {
      console.error('Assistant rate limited');
      return res.status(429).json({ error: 'Busy right now — try again in a moment.' });
    }
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('ANTHROPIC_API_KEY is missing or invalid.');
      return res.status(500).json({ error: 'Assistant unavailable.' });
    }
    console.error('Assistant chat failed:', err?.message || err);
    return res.status(500).json({ error: 'Assistant unavailable.' });
  }
}
