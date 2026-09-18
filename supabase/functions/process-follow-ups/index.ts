import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { fetchPlatformApplications, resolveLivePlatformApiUrl } from '../_shared/platform-api.ts';
import { mapPlatformSubstatus } from '../_shared/application-substatus.ts';

/**
 * Syncs live CaseFunders applications into platform_applications (which
 * triggers application follow-up scheduling) and fires due follow-up
 * notifications. Invoke on a 15-minute schedule with FOLLOW_UP_CRON_SECRET,
 * or as an authenticated admin.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const cronSecret = Deno.env.get('FOLLOW_UP_CRON_SECRET');
  const provided = req.headers.get('x-cron-secret') ?? new URL(req.url).searchParams.get('secret');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);
  const authHeader = req.headers.get('Authorization');

  let authorized = Boolean(cronSecret && provided && provided === cronSecret);
  if (!authorized && provided) {
    const { data: setting } = await admin
      .from('follow_up_settings')
      .select('value')
      .eq('key', 'cron_secret')
      .maybeSingle();
    authorized = Boolean(setting?.value && provided === setting.value);
  }
  if (!authorized && authHeader === `Bearer ${serviceKey}`) {
    authorized = true;
  }

  if (!authorized) {
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { data: roles } = await admin.from('user_roles').select('role').eq('user_id', user.id);
    authorized = (roles ?? []).some((r: { role: string }) =>
      ['super_admin', 'admin', 'sales_team_lead', 'sales', 'operations_team_lead', 'operations'].includes(r.role)
    );
  }

  if (!authorized) return jsonResponse({ error: 'Forbidden' }, 403);

  const platformApiUrl = resolveLivePlatformApiUrl();
  const apiToken = Deno.env.get('CASEFUNDERS_CRM_API_TOKEN');

  let synced = 0;
  let syncError: string | null = null;

  if (platformApiUrl && apiToken) {
    try {
      const applications = await fetchPlatformApplications({ platformApiUrl, apiToken });
      const { data: firms } = await admin
        .from('firms')
        .select('id, email, name')
        .eq('archived', false);

      const firmByEmail = new Map(
        (firms ?? [])
          .filter((f: { email: string | null }) => f.email)
          .map((f: { id: string; email: string | null }) => [f.email!.trim().toLowerCase(), f.id]),
      );

      for (const app of applications) {
        const substatus = mapPlatformSubstatus(app.status, app.funded_amount);
        const lastActivity = app.updated_at || app.created_at || new Date().toISOString();
        const firmId =
          (app.attorney_email && firmByEmail.get(app.attorney_email.trim().toLowerCase())) || null;

        const { error } = await admin.from('platform_applications').upsert(
          {
            session_id: app.session_id,
            request_id: app.request_id,
            client_name: app.client_name || 'Unknown client',
            client_email: app.client_email,
            client_phone: app.client_phone,
            firm_name: app.firm_name,
            attorney_email: app.attorney_email,
            attorney_name: app.attorney_name,
            loan_amount: app.loan_amount,
            funded_amount: app.funded_amount,
            raw_status: app.status,
            substatus,
            last_activity_at: lastActivity,
            firm_id: firmId,
            platform_url: app.platform_url,
          },
          { onConflict: 'session_id' },
        );
        if (!error) synced += 1;
      }
    } catch (e) {
      syncError = e instanceof Error ? e.message : String(e);
      console.error('platform sync failed', e);
    }
  }

  const { data: fired, error: fireErr } = await admin.rpc('process_due_follow_ups', { p_limit: 500 });
  if (fireErr) {
    return jsonResponse({ error: fireErr.message, synced, syncError }, 500);
  }

  return jsonResponse({ ok: true, synced, fired: fired ?? 0, syncError });
});
