-- Allow authenticated users to manage their own Google Calendar connection row.
-- The OAuth callback (server-side) upserts using SUPABASE_SERVICE_ROLE_KEY in
-- production, but these policies also let the client SDK upsert directly if
-- the service role key is unavailable (e.g. local dev without the secret).

CREATE POLICY "google_calendar_connections_insert_own"
  ON public.google_calendar_connections FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "google_calendar_connections_update_own"
  ON public.google_calendar_connections FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
