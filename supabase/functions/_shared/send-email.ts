/// <reference path="../deno.d.ts" />
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

export type LeadEmailPayload = {
  name: string;
  company: string;
  email: string;
  phone?: string | null;
  message?: string | null;
  page_url?: string | null;
  source?: string | null;
};

type SendMailOptions = {
  to: string[];
  subject: string;
  text: string;
  html: string;
};

function parseEmailList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function sendMail(options: SendMailOptions): Promise<boolean> {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  if (!apiKey) {
    console.warn('SENDGRID_API_KEY not set — skipping email');
    return false;
  }

  if (options.to.length === 0) {
    console.warn('No recipients — skipping email');
    return false;
  }

  const fromEmail = Deno.env.get('SENDGRID_FROM_EMAIL') ?? 'support@casefunders.com';
  const fromName = Deno.env.get('SENDGRID_FROM_NAME') ?? 'CaseFunders';

  const toLower = new Set(options.to.map((e) => e.toLowerCase()));
  const bcc = parseEmailList(Deno.env.get('DEVELOPER_EMAIL')).filter(
    (e) => !toLower.has(e.toLowerCase()),
  );

  const personalization: Record<string, unknown> = {
    to: options.to.map((email) => ({ email })),
  };
  if (bcc.length > 0) {
    personalization.bcc = bcc.map((email) => ({ email }));
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [personalization],
        from: { email: fromEmail, name: fromName },
        subject: options.subject,
        content: [
          { type: 'text/plain', value: options.text },
          { type: 'text/html', value: options.html },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('SendGrid send error:', res.status, err);
      return false;
    }

    return true;
  } catch (error) {
    console.error('SendGrid request failed:', error);
    return false;
  }
}

export async function sendLeadNotificationEmail(lead: LeadEmailPayload): Promise<void> {
  const to = parseEmailList(
    Deno.env.get('LEAD_NOTIFY_EMAILS') ??
      Deno.env.get('NO_OFFER_NOTIFICATION_EMAIL') ??
      'nick@casefunders.com',
  );

  if (to.length === 0) {
    console.warn('No lead notification recipients configured — skipping email');
    return;
  }

  const appUrl = (Deno.env.get('APP_URL') ?? 'https://casefunders-crm-d.vercel.app').replace(/\/$/, '');

  const source = lead.source || 'Website';
  const lines = [
    `Source: ${source}`,
    `Name: ${lead.name}`,
    `Firm: ${lead.company}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.message ? lead.message : null,
    lead.page_url ? `Page: ${lead.page_url}` : null,
    '',
    `View in CRM: ${appUrl}/leads`,
  ].filter(Boolean) as string[];

  await sendMail({
    to,
    subject: `New ${source} lead: ${lead.company}`,
    text: lines.join('\n'),
    html: `<p><strong>New ${escapeHtml(source)} lead</strong></p><ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul><p><a href="${escapeHtml(`${appUrl}/leads`)}">Open Leads in CRM</a></p>`,
  });
}

export async function sendLeadConfirmationEmail(lead: LeadEmailPayload): Promise<void> {
  if (!lead.email) return;

  const safeName = escapeHtml(lead.name);

  await sendMail({
    to: [lead.email],
    subject: 'We received your demo request — CaseFunders',
    text: [
      `Hi ${lead.name},`,
      '',
      'Thanks for requesting a CaseFunders demo. Our team will reach out shortly.',
      '',
      '— CaseFunders',
    ].join('\n'),
    html: `<p>Hi ${safeName},</p><p>Thanks for requesting a CaseFunders demo. Our team will reach out shortly.</p><p>— CaseFunders</p>`,
  });
}
