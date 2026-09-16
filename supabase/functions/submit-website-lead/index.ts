import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { sendLeadConfirmationEmail, sendLeadNotificationEmail } from '../_shared/send-email.ts';

type LeadBody = {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  practice?: string;
  page_url?: string;
  headline?: string;
  website?: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as LeadBody;

    if (body.website) {
      return jsonResponse({ error: 'Invalid submission' }, 400);
    }

    const name = (body.name ?? '').trim();
    const company = (body.company ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    const phone = (body.phone ?? '').trim();
    const practice = (body.practice ?? '').trim();

    if (!name || !company || !email) {
      return jsonResponse({ error: 'Name, firm name, and email are required.' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: 'Invalid email address.' }, 400);
    }

    const messageParts = [];
    if (practice) messageParts.push(`Practice area: ${practice}`);
    const message = messageParts.length ? messageParts.join('\n') : null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data, error } = await admin.from('leads').insert({
      channel: 'website',
      status: 'new',
      name,
      company,
      email,
      phone: phone || null,
      message,
      raw_payload: {
        practice: practice || null,
        page_url: body.page_url ?? null,
        headline: body.headline ?? null,
        submitted_at: new Date().toISOString(),
        source: 'cf-ads-v2',
      },
    }).select('id').single();

    if (error) {
      console.error(error);
      return jsonResponse({ error: 'Could not save your request. Please try again.' }, 500);
    }

    const leadPayload = {
      name,
      company,
      email,
      phone: phone || null,
      message,
      page_url: body.page_url ?? null,
    };

    await Promise.all([
      sendLeadNotificationEmail(leadPayload),
      sendLeadConfirmationEmail(leadPayload),
    ]);

    return jsonResponse({ success: true, id: data?.id });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
});
