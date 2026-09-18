import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { fetchPlatformApplications, resolveLivePlatformApiUrl } from '../_shared/platform-api.ts';

const APPLICATIONS_VIEW_ROLES = ['super_admin', 'admin', 'operations', 'operations_team_lead'];

/** Proxy: CRM → casefunders.com/api/crm/applications/ (token stays server-side). */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const platformApiUrl = resolveLivePlatformApiUrl();
  const apiToken = Deno.env.get('CASEFUNDERS_CRM_API_TOKEN');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!platformApiUrl || !apiToken) {
    return jsonResponse({ error: 'Platform API is not configured' }, 503);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roles, error: roleErr } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (roleErr) {
    return jsonResponse({ error: roleErr.message }, 500);
  }

  const allowed = (roles ?? []).some((r: { role: string }) =>
    APPLICATIONS_VIEW_ROLES.includes(r.role)
  );
  if (!allowed) {
    return jsonResponse({ error: 'You do not have access to applications' }, 403);
  }

  try {
    const body = req.headers.get('content-type')?.includes('application/json')
      ? await req.json().catch(() => ({}))
      : {};

    const applications = await fetchPlatformApplications({
      platformApiUrl,
      apiToken,
      sessionId: typeof body.session_id === 'string' ? body.session_id : undefined,
      since: typeof body.since === 'string' ? body.since : undefined,
    });

    return jsonResponse({ ok: true, applications });
  } catch (e) {
    console.error(e);
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Failed to load applications' },
      500,
    );
  }
});
