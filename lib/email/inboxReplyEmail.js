// The email a customer gets when admin replies to their question or story
// from the Inbox tab (pages/api/admin/inbox.js). Transactional — an answer
// to something they sent us — so, like the order emails, it skips the
// marketing unsubscribe footer and goes through sendTransactionalEmail.
// Same header (logo) and serif/sans pairing as the automation emails
// (lib/email/emailBlocks.js); their original message is quoted underneath.

import { BRAND } from './brand';

const INK = '#2E2620';
const SOFT = '#8A7F76';
const LINE = '#EDE6E1';
const SANS = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const paragraphs = (text) => escapeHtml(text).replace(/\r?\n/g, '<br/>');

export function inboxReplySubject(entry) {
  return entry.type === 'story' ? `Re: your story for ${BRAND.name}` : `Re: your message to ${BRAND.name}`;
}

export function renderInboxReplyEmail({ entry, reply, settings = {} }) {
  const logoUrl = settings.logoUrl || BRAND.logoUrl;
  const firstName = String(entry.name || '').trim().split(/\s+/)[0];
  const footerLines = [settings.companyName || BRAND.name, settings.physicalAddress].filter(Boolean).map(escapeHtml).join('<br/>');
  const asked = new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F3F0;">
  <tr><td align="center" style="padding:24px 0;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">
      <tr><td style="padding:32px 24px 20px;text-align:center;border-bottom:1px solid ${LINE};"><a href="${BRAND.siteUrl}" style="text-decoration:none;"><img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(BRAND.name)}" width="180" style="width:180px;max-width:60%;height:auto;display:inline-block;border:0;" /></a></td></tr>
      <tr><td style="padding:32px 40px 8px;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK};">
        ${firstName ? `<p style="margin:0 0 16px;">Hi ${escapeHtml(firstName)},</p>` : ''}
        <p style="margin:0 0 16px;">${paragraphs(reply)}</p>
      </td></tr>
      <tr><td style="padding:8px 40px 32px;">
        <div style="border-left:3px solid #FBD9E4;padding:4px 0 4px 14px;font-family:${SANS};font-size:13px;line-height:1.6;color:${SOFT};">
          <div style="margin-bottom:4px;">You wrote on ${escapeHtml(asked)}:</div>
          ${paragraphs(entry.text)}
        </div>
      </td></tr>
      <tr><td style="padding:24px;text-align:center;font-family:${SANS};font-size:12px;line-height:1.6;color:${INK};background:#FBD9E4;">${footerLines}</td></tr>
    </table>
  </td></tr>
</table>`;
}
