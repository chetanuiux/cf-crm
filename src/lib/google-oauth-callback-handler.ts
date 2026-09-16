import { verifyState, exchangeGoogleCodeAndStore } from '@/lib/google-oauth.server';

type RuntimeEnv = Record<string, string | undefined>;

function readEnv(runtime?: RuntimeEnv) {
  const e = runtime ?? process.env;
  return {
    appUrl: (e.APP_URL ?? e.VITE_APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
    clientId: e.GOOGLE_CLIENT_ID,
    clientSecret: e.GOOGLE_CLIENT_SECRET,
    redirectUri: e.GOOGLE_REDIRECT_URI,
    stateSecret: e.GOOGLE_OAUTH_STATE_SECRET,
    supabaseUrl: e.SUPABASE_URL ?? e.VITE_SUPABASE_URL,
    serviceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY,
  };
}

function redirect(appUrl: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${appUrl.replace(/\/$/, '')}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
}

export async function handleGoogleOAuthCallback(
  request: Request,
  runtimeEnv?: RuntimeEnv,
): Promise<Response> {
  const env = readEnv(runtimeEnv);
  const url = new URL(request.url);
  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    return redirect(env.appUrl, '/calendar', { google: 'error', message: oauthError });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return redirect(env.appUrl, '/calendar', { google: 'error', message: 'missing_code' });
  }

  if (!env.clientId || !env.clientSecret || !env.redirectUri || !env.stateSecret || !env.supabaseUrl || !env.serviceRoleKey) {
    return redirect(env.appUrl, '/calendar', { google: 'error', message: 'oauth_not_configured' });
  }

  const userId = verifyState(state, env.stateSecret);
  if (!userId) {
    return redirect(env.appUrl, '/calendar', { google: 'error', message: 'invalid_state' });
  }

  try {
    await exchangeGoogleCodeAndStore({
      code,
      userId,
      clientId: env.clientId,
      clientSecret: env.clientSecret,
      redirectUri: env.redirectUri,
      supabaseUrl: env.supabaseUrl,
      serviceRoleKey: env.serviceRoleKey,
    });
    return redirect(env.appUrl, '/calendar', { google: 'connected' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'callback_failed';
    return redirect(env.appUrl, '/calendar', { google: 'error', message: msg.slice(0, 120) });
  }
}
