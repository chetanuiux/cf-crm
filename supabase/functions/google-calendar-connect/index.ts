import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import { googleAuthUrl, signState } from '../_shared/google-oauth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI');
    const stateSecret = Deno.env.get('GOOGLE_OAUTH_STATE_SECRET');
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173';

    if (!clientId || !redirectUri || !stateSecret) {
      return jsonResponse({
        error: 'Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, and GOOGLE_OAUTH_STATE_SECRET in Supabase Edge Function secrets.',
        auth_url: null,
      }, 503);
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const state = await signState(user.id, stateSecret);
    const auth_url = googleAuthUrl({ clientId, redirectUri, state });

    return jsonResponse({ auth_url, app_url: appUrl });
  } catch (e) {
    return jsonResponse({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
