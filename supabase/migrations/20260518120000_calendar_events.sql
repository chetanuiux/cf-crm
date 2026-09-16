-- Calendar events + Google Calendar connections

CREATE TABLE public.calendar_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_event_id  TEXT,
  user_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  firm_id          UUID REFERENCES public.firms(id) ON DELETE SET NULL,
  application_id   UUID REFERENCES public.client_applications(id) ON DELETE SET NULL,
  firm_name        TEXT,
  application_ref  TEXT,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  event_type       TEXT NOT NULL,
  start_at         TIMESTAMPTZ NOT NULL,
  end_at           TIMESTAMPTZ NOT NULL,
  timezone         TEXT NOT NULL,
  attendees        JSONB NOT NULL DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'confirmed',
  is_recurring     BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule  TEXT,
  location         TEXT,
  meeting_url      TEXT,
  reminder_24h_sent BOOLEAN NOT NULL DEFAULT false,
  reminder_1h_sent  BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_event_type_check CHECK (
    event_type IN ('demo', 'discovery', 'follow_up', 'underwriting', 'signing', 'internal')
  ),
  CONSTRAINT calendar_events_status_check CHECK (
    status IN ('confirmed', 'tentative', 'cancelled')
  ),
  CONSTRAINT calendar_events_time_check CHECK (end_at > start_at)
);

CREATE INDEX idx_calendar_events_start ON public.calendar_events(start_at);
CREATE INDEX idx_calendar_events_user ON public.calendar_events(user_id);
CREATE INDEX idx_calendar_events_firm ON public.calendar_events(firm_id);

CREATE TRIGGER trg_calendar_events_updated
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.google_calendar_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  access_token  TEXT,
  refresh_token TEXT,
  last_sync     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_google_calendar_connections_updated
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_select"
  ON public.calendar_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "calendar_events_insert"
  ON public.calendar_events FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "calendar_events_update"
  ON public.calendar_events FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "calendar_events_delete"
  ON public.calendar_events FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "google_calendar_connections_select_own"
  ON public.google_calendar_connections FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "google_calendar_connections_delete_own"
  ON public.google_calendar_connections FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Inserts/updates for connections are done via Edge Functions (service role)

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;

-- Future: email reminders (pg_cron or scheduled Edge Function)
-- Query: WHERE start_at BETWEEN now() AND now() + interval '24 hours' AND reminder_24h_sent = false
-- Then set reminder_24h_sent = true after sending via Resend/SendGrid.
