import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { sendLeadConfirmationEmail, sendLeadNotificationEmail } from '../_shared/send-email.ts';
import {
  extractLeadFormId,
  extractSponsoredAccountId,
  extractUrnId,
  hasContact,
  hmacSha256Hex,
  isLeadActionNotification,
  LINKEDIN_AD_ACCOUNT_ID,
  LINKEDIN_SOURCE_TAG,
  mapDirectPayload,
  mapLinkedInFormResponse,
  type NormalizedLead,
} from '../_shared/linkedin-lead.ts';

const LINKEDIN_API_VERSION = Deno.env.get('LINKEDIN_API_VERSION') ?? '202508';
const EXPECTED_ACCOUNT_ID =
  Deno.env.get('LINKEDIN_AD_ACCOUNT_ID') ?? LINKEDIN_AD_ACCOUNT_ID;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

async function linkedinGet(path: string, token: string): Promise<JsonRecord> {
  const res = await fetch(`https://api.linkedin.com/rest/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Linkedin-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`LinkedIn API ${res.status}: ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as JsonRecord;
}

async function fetchLinkedInLead(notification: JsonRecord): Promise<NormalizedLead> {
  const token = Deno.env.get('LINKEDIN_ACCESS_TOKEN');
  if (!token) {
    throw new Error('LINKEDIN_ACCESS_TOKEN is not configured');
  }

  const accountId = extractSponsoredAccountId(notification.owner) ?? EXPECTED_ACCOUNT_ID;
  if (accountId && accountId !== EXPECTED_ACCOUNT_ID) {
    throw new Error(`Unexpected LinkedIn ad account ${accountId}`);
  }

  const responseId = extractUrnId(notification.leadGenFormResponse);
  if (!responseId) {
    throw new Error('Missing leadGenFormResponse id');
  }

  const encodedId = encodeURIComponent(responseId);
  const response = await linkedinGet(`leadFormResponses/${encodedId}`, token);

  const formId =
    extractLeadFormId(response.versionedLeadGenFormUrn) ??
    extractLeadFormId(notification.leadGenForm);
  let form: JsonRecord | null = null;
  if (formId) {
    try {
      form = await linkedinGet(`leadForms/${formId}`, token);
    } catch (err) {
      console.error('Failed to load LinkedIn lead form definition', err);
    }
  }

  return mapLinkedInFormResponse(response, form);
}

function webhookSecretFromReq(req: Request, url: URL): string | null {
  return (
    req.headers.get('x-webhook-secret') ??
    req.headers.get('x-linkedin-token') ??
    url.searchParams.get('token')
  );
}

function isMappedPayloadAuthorized(req: Request, url: URL): boolean {
  const expected = Deno.env.get('LINKEDIN_WEBHOOK_SECRET');
  if (!expected) return true;
  const provided = webhookSecretFromReq(req, url);
  return provided === expected;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const challengeCode = url.searchParams.get('challengeCode');
    if (!challengeCode) {
      return jsonResponse({ ok: true, service: 'ingest-linkedin-lead' });
    }
    const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');
    if (!clientSecret) {
      return jsonResponse({ error: 'LINKEDIN_CLIENT_SECRET is not configured' }, 500);
    }
    const challengeResponse = await hmacSha256Hex(challengeCode, clientSecret);
    return jsonResponse({ challengeCode, challengeResponse });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const rawBody = await req.text();
  let body: unknown = {};
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }
  }

  const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET');
  const liSignature = req.headers.get('x-li-signature') ?? req.headers.get('X-LI-Signature');
  if (clientSecret && liSignature) {
    const expected = await hmacSha256Hex(`hmacsha256=${rawBody}`, clientSecret);
    if (expected !== liSignature.toLowerCase()) {
      return jsonResponse({ error: 'Invalid signature' }, 401);
    }
  }

  try {
    let lead: NormalizedLead;
    let notification: JsonRecord | null = null;

    if (isLeadActionNotification(body)) {
      notification = body;
      if (asRecord(body)?.leadAction === 'DELETED') {
        return jsonResponse({ ok: true, skipped: true, reason: 'deleted' });
      }
      lead = await fetchLinkedInLead(body);
    } else {
      if (!isMappedPayloadAuthorized(req, url)) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
      lead = mapDirectPayload(body);
    }

    if (!hasContact(lead)) {
      return jsonResponse({ error: 'Lead is missing name, email, and phone.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (lead.external_id) {
      const { data: existing } = await admin
        .from('leads')
        .select('id')
        .eq('channel', 'linkedin')
        .eq('external_id', lead.external_id)
        .maybeSingle();
      if (existing?.id) {
        return jsonResponse({ success: true, id: existing.id, duplicate: true });
      }
    }

    const insertRow = {
      channel: 'linkedin' as const,
      status: 'new' as const,
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      state: lead.state,
      funding_amount: lead.funding_amount,
      client_name: null,
      message: lead.message,
      external_id: lead.external_id,
      raw_payload: {
        source: LINKEDIN_SOURCE_TAG,
        source_tag: 'LinkedIn',
        ad_account_id: EXPECTED_ACCOUNT_ID,
        submitted_at: new Date().toISOString(),
        notification,
        body,
      },
    };

    const { data, error } = await admin.from('leads').insert(insertRow).select('id').single();
    if (error) {
      if (error.code === '23505') {
        return jsonResponse({ success: true, duplicate: true });
      }
      console.error(error);
      return jsonResponse({ error: 'Could not save LinkedIn lead.' }, 500);
    }

    const emailPayload = {
      name: lead.name ?? 'Unknown',
      company: lead.company ?? 'Unknown firm',
      email: lead.email ?? '',
      phone: lead.phone,
      message: lead.message,
      page_url: null,
      source: 'LinkedIn Ads',
    };

    await Promise.all([
      sendLeadNotificationEmail(emailPayload),
      lead.email ? sendLeadConfirmationEmail(emailPayload) : Promise.resolve(),
    ]);

    return jsonResponse({ success: true, id: data?.id });
  } catch (e) {
    console.error(e);
    return jsonResponse({ error: e instanceof Error ? e.message : 'Invalid request' }, 400);
  }
});
