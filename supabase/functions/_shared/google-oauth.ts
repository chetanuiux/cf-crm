const encoder = new TextEncoder();

export async function signState(userId: string, secret: string): Promise<string> {
  const payload = `${userId}.${crypto.randomUUID()}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}.${sigB64}`;
}

export async function verifyState(state: string, secret: string): Promise<string | null> {
  const [payloadB64, sigB64] = state.split('.');
  if (!payloadB64 || !sigB64) return null;

  const payload = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = Uint8Array.from(
    atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payload));
  if (!valid) return null;
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
