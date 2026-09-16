import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { verifyState } from '../_shared/google-oauth.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:5173';
  const calendarPath = `${appUrl.replace(/\/$/, '')}/calendar`;

  if (oauthError) {
    return Response.redirect(`${calendarPath}?google=error&message=${encodeURIComponent(oauthError)}`, 302);
  }

  if (!code || !state) {
    return Response.redirect(`${calendarPath}?google=error&message=missing_code`, 302);
  }

  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
    const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')!;
    const stateSecret = Deno.env.get('GOOGLE_OAUTH_STATE_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userId = await verifyState(state, stateSecret);
    if (!userId) {
      return Response.redirect(`${calendarPath}?google=error&message=invalid_state`, 302);
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      return Response.redirect(
        `${calendarPath}?google=error&message=${encodeURIComponent(errText.slice(0, 120))}`,
        302,
      );
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    let email = 'google-calendar@connected';
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (userInfoRes.ok) {
      const info = await userInfoRes.json() as { email?: string };
      if (info.email) email = info.email;
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: upsertErr } = await admin.from('google_calendar_connections').upsert(
      {
        user_id: userId,
        email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        last_sync: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (upsertErr) {
      return Response.redirect(
        `${calendarPath}?google=error&message=${encodeURIComponent(upsertErr.message)}`,
        302,
      );
    }

    return Response.redirect(`${calendarPath}?google=connected`, 302);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'callback_failed';
    return Response.redirect(`${calendarPath}?google=error&message=${encodeURIComponent(msg)}`, 302);
  }
});
