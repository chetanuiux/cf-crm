import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signState(userId: string, secret: string): string {
  const payload = `${userId}.${randomUUID()}`;
  const sig = createHmac('sha256', secret).update(payload).digest();
  return `${base64UrlEncode(payload)}.${base64UrlEncode(sig)}`;
}

export function verifyState(state: string, secret: string): string | null {
  const [payloadB64, sigB64] = state.split('.');
  if (!payloadB64 || !sigB64) return null;

  const payload = base64UrlDecode(payloadB64).toString('utf8');
  const expected = createHmac('sha256', secret).update(payload).digest();
  const actual = base64UrlDecode(sigB64);

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  return payload.split('.')[0] ?? null;
}

export function googleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events email',
    access_type: 'offline',
    prompt: 'consent',
    state: params.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`;
}

export async function exchangeGoogleCodeAndStore(params: {
  code: string;
  userId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  supabaseUrl: string;
  serviceRoleKey: string;
}): Promise<{ email: string }> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(await tokenRes.text());
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
  };

  let email = 'google-calendar@connected';
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (userInfoRes.ok) {
    const info = (await userInfoRes.json()) as { email?: string };
    if (info.email) email = info.email;
  }

  const upsertRes = await fetch(`${params.supabaseUrl}/rest/v1/google_calendar_connections`, {
    method: 'POST',
    headers: {
      apikey: params.serviceRoleKey,
      Authorization: `Bearer ${params.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: params.userId,
      email,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      last_sync: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });

  if (!upsertRes.ok) {
    throw new Error(await upsertRes.text());
  }

  return { email };
}
