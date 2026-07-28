import React from 'react';
import { T, S } from '../lib/theme';

// Browsing assistant — a small launcher in the corner that opens a chat
// panel, backed by Claude via /api/chat.
//
// First-time browsers get it opened for them once, after they've been on the
// page long enough to have started looking at something; everyone else gets
// the quiet launcher and opens it if they want it. The "first time" flag
// lives in localStorage, so it's once per browser rather than once per tab —
// re-greeting a returning shopper on every visit is what makes this kind of
// widget feel like a popup ad instead of a shop assistant.
//
// enabled is passed by pages/_app.jsx, which keeps it off checkout, admin,
// and the ad-funnel pages — anywhere with a single job that a chat window
// would only compete with.

const SEEN_KEY = 'veil-assistant-seen';
const AUTO_OPEN_MS = 25000;
const GREETING = 'Hi — first time here? I can help you find the right scent, or answer anything about the powders.';

export default function ShopAssistant({ enabled = true }) {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState('');
  const autoOpenedRef = React.useRef(false);
  const scrollRef = React.useRef(null);

  // Auto-open once for a first-time browser. Returning visitors are left
  // alone — the launcher is still there if they want it.
  React.useEffect(() => {
    if (!enabled) return undefined;
    let seen = true;
    try {
      seen = window.localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // Private browsing / blocked storage: treat as a returning visitor
      // rather than greeting them on every single page view.
    }
    if (seen) return undefined;

    const timer = setTimeout(() => {
      if (autoOpenedRef.current) return;
      autoOpenedRef.current = true;
      markSeen();
      setOpen(true);
    }, AUTO_OPEN_MS);
    return () => clearTimeout(timer);
  }, [enabled]);

  // Pin to the newest message as the conversation grows.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const markSeen = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // ignore storage failures
    }
  };

  const handleOpen = () => {
    markSeen();
    setOpen(true);
  };

  const send = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    // The greeting is presentational only — it's rendered locally and never
    // sent as an assistant turn, so the model isn't credited with words it
    // didn't write.
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setError('');
    setSending(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err.message || 'Couldn’t send that — please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!enabled) return null;

  return (
    <>
      {!open && (
        <button type="button" onClick={handleOpen} style={launcher} aria-label="Chat with us">
          <ChatIcon />
          <span>Need help?</span>
        </button>
      )}

      {open && (
        <div style={panel} role="dialog" aria-label="Shopping assistant">
          <div style={header}>
            <div>
              <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 700 }}>VEIL assistant</div>
              <div style={{ fontSize: 11, color: T.soft, marginTop: 2 }}>Answers in a moment</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} style={closeBtn} aria-label="Close chat">✕</button>
          </div>

          <div ref={scrollRef} style={log}>
            <Bubble role="assistant">{GREETING}</Bubble>
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role}>{m.content}</Bubble>
            ))}
            {sending && <Bubble role="assistant" muted>Typing…</Bubble>}
            {error && <p style={errorText}>{error}</p>}
          </div>

          <form onSubmit={send} style={composer}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a scent…"
              maxLength={1000}
              style={field}
              aria-label="Message"
            />
            <button type="submit" disabled={!input.trim() || sending} style={{ ...sendBtn, opacity: !input.trim() || sending ? 0.4 : 1 }}>
              Send
            </button>
          </form>
          <p style={disclaimer}>AI assistant — it can make mistakes.</p>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 520px) {
          div[role='dialog'] { right: 12px !important; left: 12px !important; width: auto !important; }
        }
      `}</style>
    </>
  );
}

function Bubble({ role, muted, children }) {
  const mine = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <div
        style={{
          maxWidth: '85%', padding: '10px 13px', borderRadius: 14, fontSize: 14, lineHeight: 1.55,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          background: mine ? T.ink : T.paper,
          color: mine ? T.white : (muted ? T.soft : T.ink),
          borderBottomRightRadius: mine ? 4 : 14,
          borderBottomLeftRadius: mine ? 14 : 4,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

const launcher = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 150,
  display: 'flex', alignItems: 'center', gap: 9,
  background: T.ink, color: T.white, border: 'none', cursor: 'pointer',
  padding: '13px 20px', borderRadius: 999,
  fontFamily: T.sans, fontSize: 13, fontWeight: 700,
  boxShadow: '0 8px 24px rgba(22,20,15,0.22)',
};
const panel = {
  position: 'fixed', bottom: 24, right: 24, zIndex: 150,
  width: 360, maxHeight: 'min(560px, calc(100vh - 48px))',
  display: 'flex', flexDirection: 'column',
  background: T.white, border: `1px solid ${T.line}`, borderRadius: 16,
  boxShadow: '0 18px 44px rgba(22,20,15,0.20)', overflow: 'hidden',
};
const header = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '14px 16px', borderBottom: `1px solid ${T.line}`, flexShrink: 0,
};
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: T.soft, padding: 4,
};
const log = { flex: 1, minHeight: 160, overflowY: 'auto', padding: '16px 16px 4px' };
const composer = {
  display: 'flex', gap: 8, padding: '10px 12px 4px', borderTop: `1px solid ${T.line}`, flexShrink: 0,
};
const field = {
  flex: 1, height: 42, padding: '0 14px', border: `1px solid ${T.line}`, borderRadius: 999,
  fontFamily: T.sans, fontSize: 14, color: T.ink, outline: 'none', background: T.white, minWidth: 0,
};
const sendBtn = {
  ...S.btnFill, height: 42, borderRadius: 999, padding: '0 18px',
  fontSize: 12, letterSpacing: 'normal', textTransform: 'none', fontWeight: 700, flexShrink: 0,
};
const errorText = { fontSize: 12, color: '#a13d2b', margin: '4px 0 8px' };
const disclaimer = {
  fontSize: 10, color: T.soft, textAlign: 'center', padding: '4px 12px 12px', margin: 0,
};
