import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { signState, googleAuthUrl } from './google-oauth.server';

export const getGoogleCalendarAuthUrl = createServerFn()
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    const stateSecret = process.env.GOOGLE_OAUTH_STATE_SECRET;

    if (!clientId || !redirectUri || !stateSecret) {
      throw new Error(
        'Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, and GOOGLE_OAUTH_STATE_SECRET in server environment variables.',
      );
    }

    const state = signState(context.userId, stateSecret);
    return { auth_url: googleAuthUrl({ clientId, redirectUri, state }) };
  });
