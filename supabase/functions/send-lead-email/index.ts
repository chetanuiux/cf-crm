import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { sendLeadConfirmationEmail, sendLeadNotificationEmail } from '../_shared/send-email.ts';

type WebhookPayload = {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    channel: string;
    status: string;
    name: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    message: string | null;
    raw_payload: Record<string, unknown> | null;
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.type !== 'INSERT' || payload.table !== 'leads') {
      return jsonResponse({ ok: true, skipped: true });
    }

    const r = payload.record;
    if (r.status !== 'new') {
      return jsonResponse({ ok: true, skipped: true });
    }

    const source =
      r.channel === 'linkedin'
        ? 'LinkedIn Ads'
        : r.channel === 'website'
          ? 'Website'
          : r.channel;

    const leadPayload = {
      name: r.name ?? 'Unknown',
      company: r.company ?? 'Unknown firm',
      email: r.email ?? '',
      phone: r.phone,
      message: r.message,
      page_url: typeof r.raw_payload?.page_url === 'string' ? r.raw_payload.page_url : null,
      source,
    };

    if (r.channel === 'website' || r.channel === 'linkedin') {
      await Promise.all([
        sendLeadNotificationEmail(leadPayload),
        sendLeadConfirmationEmail(leadPayload),
      ]);
    } else {
      await sendLeadNotificationEmail(leadPayload);
    }

    return jsonResponse({ ok: true });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
