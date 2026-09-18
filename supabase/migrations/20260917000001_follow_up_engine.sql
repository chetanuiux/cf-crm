-- CaseFunders sales + application follow-up engine.
-- Implements the attorney sales and application substatus follow-up rules.

-- =============================================
-- Data remap onto the new ledger
-- =============================================
UPDATE public.firms SET sales_status = 'signed_up'
 WHERE sales_status = 'demo_completed_signed_up';
UPDATE public.firms SET sales_status = 'demo_completed'
 WHERE sales_status = 'demo_completed_didnt_sign_up';
UPDATE public.firms SET sales_status = 'contacted'
 WHERE sales_status IN ('interested', 'signup_link_sent', 'reconnect_later');
UPDATE public.firms SET sales_status = 'demo_completed'
 WHERE sales_status = 'follow_up_after_demo';
UPDATE public.firms SET sales_status = 'demo_booked'
 WHERE sales_status = 'demo_needs_reschedule';

UPDATE public.firms SET onboarding_status = 'onboarding_submitted'
 WHERE onboarding_status IN ('signup_submitted', 'bank_account_connected');
UPDATE public.firms SET onboarding_status = 'onboarding_approved'
 WHERE onboarding_status IN ('onboarding_done', 'ready_for_first_application', 'complete');
UPDATE public.firms SET onboarding_status = 'first_case_funded'
 WHERE onboarding_status = 'completed_first_application';
UPDATE public.firms SET onboarding_status = 'three_cases_funded'
 WHERE onboarding_status = 'funded_three_cases';

UPDATE public.client_applications SET status = 'application_invite_sent' WHERE status = 'link_sent';
UPDATE public.client_applications SET status = 'application_incomplete' WHERE status IN ('application_started', 'submitted');
UPDATE public.client_applications SET status = 'no_offers_available' WHERE status = 'no_offers';
UPDATE public.client_applications SET status = 'offer_selection_needed' WHERE status = 'offers_available';
UPDATE public.client_applications SET status = 'offer_processing' WHERE status IN ('client_selected_offer', 'approved');
UPDATE public.client_applications SET status = 'client_declined_offers' WHERE status = 'declined';
UPDATE public.client_applications SET status = 'error' WHERE status = 'issue_stuck';
UPDATE public.client_applications SET status = 'application_withdrawn' WHERE status = 'cancelled';

-- =============================================
-- Firm follow-up columns
-- =============================================
ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS pipeline_status_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS auto_follow_up_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promised_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS demo_scheduled_at TIMESTAMPTZ;

UPDATE public.firms
   SET pipeline_status_entered_at = COALESCE(last_activity_date, created_at, now())
 WHERE pipeline_status_entered_at IS NULL
    OR pipeline_status_entered_at = created_at;

-- =============================================
-- Notifications: link to firms / applications / follow-ups
-- =============================================
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES public.client_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS follow_up_id UUID,
  ADD COLUMN IF NOT EXISTS platform_session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notifications_firm ON public.notifications(firm_id);
CREATE INDEX IF NOT EXISTS idx_notifications_follow_up ON public.notifications(follow_up_id);

-- =============================================
-- Platform application cache (live CaseFunders apps)
-- =============================================
CREATE TABLE IF NOT EXISTS public.platform_applications (
  session_id TEXT PRIMARY KEY,
  request_id TEXT,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  client_phone TEXT,
  firm_name TEXT,
  attorney_email TEXT,
  attorney_name TEXT,
  loan_amount NUMERIC,
  funded_amount NUMERIC,
  raw_status TEXT,
  substatus TEXT NOT NULL DEFAULT 'application_invite_sent',
  substatus_entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  auto_follow_up_count INT NOT NULL DEFAULT 0,
  escalated BOOLEAN NOT NULL DEFAULT false,
  firm_id UUID REFERENCES public.firms(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  platform_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_apps_substatus ON public.platform_applications(substatus);
CREATE INDEX IF NOT EXISTS idx_platform_apps_firm ON public.platform_applications(firm_id);

DROP TRIGGER IF EXISTS trg_platform_applications_updated ON public.platform_applications;
CREATE TRIGGER trg_platform_applications_updated
  BEFORE UPDATE ON public.platform_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.platform_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_applications_select ON public.platform_applications;
CREATE POLICY platform_applications_select ON public.platform_applications
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS platform_applications_write ON public.platform_applications;
CREATE POLICY platform_applications_write ON public.platform_applications
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid()))
  WITH CHECK (public.has_any_role(auth.uid()));

-- =============================================
-- Follow-up queue
-- =============================================
CREATE TABLE IF NOT EXISTS public.follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('sales', 'application')),
  source TEXT NOT NULL DEFAULT 'automatic' CHECK (source IN ('automatic', 'manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'completed', 'cancelled')),
  pipeline_status TEXT NOT NULL,
  sequence_index INT NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  skip_business_hours BOOLEAN NOT NULL DEFAULT false,
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  firm_id UUID REFERENCES public.firms(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.client_applications(id) ON DELETE CASCADE,
  platform_session_id TEXT,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT follow_ups_subject_chk CHECK (
    (kind = 'sales' AND firm_id IS NOT NULL)
    OR (kind = 'application' AND platform_session_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON public.follow_ups(status, due_at);
CREATE INDEX IF NOT EXISTS idx_follow_ups_firm ON public.follow_ups(firm_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_session ON public.follow_ups(platform_session_id);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned ON public.follow_ups(assigned_to);

CREATE UNIQUE INDEX IF NOT EXISTS follow_ups_one_auto_sales
  ON public.follow_ups (firm_id)
  WHERE kind = 'sales' AND source = 'automatic' AND status IN ('pending', 'notified');

CREATE UNIQUE INDEX IF NOT EXISTS follow_ups_one_auto_app
  ON public.follow_ups (platform_session_id)
  WHERE kind = 'application' AND source = 'automatic' AND status IN ('pending', 'notified')
    AND platform_session_id IS NOT NULL;

ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS follow_ups_platform_session_id_fkey;
ALTER TABLE public.follow_ups
  ADD CONSTRAINT follow_ups_platform_session_id_fkey
  FOREIGN KEY (platform_session_id) REFERENCES public.platform_applications(session_id) ON DELETE CASCADE;

DROP TRIGGER IF EXISTS trg_follow_ups_updated ON public.follow_ups;
CREATE TRIGGER trg_follow_ups_updated
  BEFORE UPDATE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS follow_ups_select ON public.follow_ups;
CREATE POLICY follow_ups_select ON public.follow_ups
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS follow_ups_insert ON public.follow_ups;
CREATE POLICY follow_ups_insert ON public.follow_ups
  FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS follow_ups_update ON public.follow_ups;
CREATE POLICY follow_ups_update ON public.follow_ups
  FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid()));
DROP POLICY IF EXISTS follow_ups_delete ON public.follow_ups;
CREATE POLICY follow_ups_delete ON public.follow_ups
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_follow_up_id_fkey;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_follow_up_id_fkey
  FOREIGN KEY (follow_up_id) REFERENCES public.follow_ups(id) ON DELETE SET NULL;

-- =============================================
-- Business-hours helpers (America/Los_Angeles, Mon–Fri 08:00–18:00)
-- =============================================
CREATE OR REPLACE FUNCTION public.follow_up_tz()
RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'America/Los_Angeles'::text $$;

CREATE OR REPLACE FUNCTION public.roll_to_business_hours(p_ts timestamptz, p_skip boolean DEFAULT false)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  tz text := public.follow_up_tz();
  local_ts timestamp;
  local_date date;
  tod time;
  dow int;
BEGIN
  IF p_skip OR p_ts IS NULL THEN
    RETURN p_ts;
  END IF;
  local_ts := p_ts AT TIME ZONE tz;
  local_date := local_ts::date;
  tod := local_ts::time;
  dow := EXTRACT(DOW FROM local_date)::int; -- 0 Sun .. 6 Sat

  IF dow IN (0, 6) OR tod >= time '18:00' THEN
    LOOP
      local_date := local_date + 1;
      dow := EXTRACT(DOW FROM local_date)::int;
      EXIT WHEN dow BETWEEN 1 AND 5;
    END LOOP;
    RETURN (local_date::timestamp + time '08:00') AT TIME ZONE tz;
  END IF;

  IF tod < time '08:00' THEN
    RETURN (local_date::timestamp + time '08:00') AT TIME ZONE tz;
  END IF;

  RETURN p_ts;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_business_days(p_from timestamptz, p_days int)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  tz text := public.follow_up_tz();
  d date;
  added int := 0;
  step int;
  target int;
  tod time;
BEGIN
  IF p_days = 0 THEN
    RETURN public.roll_to_business_hours(p_from);
  END IF;
  d := (p_from AT TIME ZONE tz)::date;
  tod := (p_from AT TIME ZONE tz)::time;
  step := CASE WHEN p_days >= 0 THEN 1 ELSE -1 END;
  target := abs(p_days);
  WHILE added < target LOOP
    d := d + step;
    IF EXTRACT(DOW FROM d)::int BETWEEN 1 AND 5 THEN
      added := added + 1;
    END IF;
  END LOOP;
  RETURN public.roll_to_business_hours((d::timestamp + tod) AT TIME ZONE tz);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_business_hours(p_from timestamptz, p_hours numeric)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  tz text := public.follow_up_tz();
  current_ts timestamptz := public.roll_to_business_hours(p_from);
  remaining interval := (p_hours || ' hours')::interval;
  local_ts timestamp;
  local_date date;
  end_of_day timestamptz;
  available interval;
  dow int;
BEGIN
  WHILE remaining > interval '0' LOOP
    local_ts := current_ts AT TIME ZONE tz;
    local_date := local_ts::date;
    end_of_day := (local_date::timestamp + time '18:00') AT TIME ZONE tz;
    available := end_of_day - current_ts;
    IF available <= interval '0' THEN
      current_ts := public.roll_to_business_hours(end_of_day + interval '1 minute');
      CONTINUE;
    END IF;
    IF remaining <= available THEN
      RETURN current_ts + remaining;
    END IF;
    remaining := remaining - available;
    current_ts := public.roll_to_business_hours(end_of_day + interval '1 minute');
  END LOOP;
  RETURN current_ts;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_morning_pt(p_from timestamptz, p_n int)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  tz text := public.follow_up_tz();
  d date := ((p_from AT TIME ZONE tz)::date);
  n int := 0;
BEGIN
  -- First eligible morning is the next 08:00 PT strictly after p_from.
  LOOP
    d := d + 1;
    IF EXTRACT(DOW FROM d)::int BETWEEN 1 AND 5 THEN
      n := n + 1;
      IF n >= p_n THEN
        RETURN (d::timestamp + time '08:00') AT TIME ZONE tz;
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- =============================================
-- Pipeline status
-- =============================================
CREATE OR REPLACE FUNCTION public.firm_pipeline_status(
  p_sales public.firm_sales_status,
  p_onboarding public.firm_onboarding_status
) RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_sales::text IN ('lost_not_interested', 'dnc') THEN p_sales::text
    WHEN p_sales::text IN ('demo_completed_signed_up', 'signed_up') THEN
      CASE
        WHEN p_onboarding::text IN ('onboarding_submitted', 'signup_submitted', 'bank_account_connected') THEN 'onboarding_submitted'
        WHEN p_onboarding::text IN ('onboarding_approved', 'onboarding_done', 'ready_for_first_application', 'complete') THEN 'onboarding_approved'
        WHEN p_onboarding::text IN ('first_case_funded', 'completed_first_application') THEN 'first_case_funded'
        WHEN p_onboarding::text IN ('three_cases_funded', 'funded_three_cases') THEN 'three_cases_funded'
        ELSE 'signed_up'
      END
    WHEN p_sales::text = 'demo_completed_didnt_sign_up' THEN 'demo_completed'
    WHEN p_sales::text IN ('interested', 'signup_link_sent', 'reconnect_later') THEN 'contacted'
    WHEN p_sales::text IN ('follow_up_after_demo') THEN 'demo_completed'
    WHEN p_sales::text = 'demo_needs_reschedule' THEN 'demo_booked'
    ELSE p_sales::text
  END
$$;

-- =============================================
-- Cadence: sales
-- Returns jsonb {due_at, skip_roll, is_internal} or NULL to stop.
-- p_count is how many automatic follow-ups have already been created.
-- =============================================
CREATE OR REPLACE FUNCTION public.compute_sales_follow_up_due(
  p_status text,
  p_entered_at timestamptz,
  p_count int,
  p_promised_at timestamptz,
  p_demo_at timestamptz,
  p_reconnect_date date
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  due timestamptz;
  skip_roll boolean := false;
  is_internal boolean := false;
  c int := GREATEST(p_count, 0);
  promised timestamptz;
  entered timestamptz := COALESCE(p_entered_at, now());
BEGIN
  promised := COALESCE(
    p_promised_at,
    CASE WHEN p_reconnect_date IS NOT NULL
      THEN public.roll_to_business_hours((p_reconnect_date::timestamp + time '08:00') AT TIME ZONE public.follow_up_tz())
      ELSE NULL END
  );
  IF promised IS NOT NULL THEN
    RETURN jsonb_build_object(
      'due_at', promised,
      'skip_roll', false,
      'is_internal', false
    );
  END IF;

  IF p_status IN ('three_cases_funded', 'lost_not_interested', 'dnc') THEN
    RETURN NULL;
  END IF;

  IF p_status = 'new_lead' THEN
    -- 0: immediate; 1–5: each business day; then every 3 BD through day 14; then weekly for 4 weeks.
    IF c = 0 THEN
      due := entered;
    ELSE
      DECLARE
        i int;
        t timestamptz := entered;
        day14 date := (entered AT TIME ZONE public.follow_up_tz())::date + 14;
        weekly_count int := 0;
        candidate timestamptz;
      BEGIN
        FOR i IN 1..c LOOP
          IF i <= 5 THEN
            t := public.add_business_days(entered, i);
          ELSE
            candidate := public.add_business_days(t, 3);
            IF (candidate AT TIME ZONE public.follow_up_tz())::date <= day14 THEN
              t := candidate;
            ELSE
              weekly_count := weekly_count + 1;
              IF weekly_count > 4 THEN
                RETURN NULL;
              END IF;
              t := public.roll_to_business_hours(
                (day14::timestamp + time '08:00') AT TIME ZONE public.follow_up_tz()
                + (weekly_count * interval '7 days')
              );
            END IF;
          END IF;
        END LOOP;
        due := t;
      END;
    END IF;

  ELSIF p_status IN ('contacted', 'demo_no_show', 'interested', 'reconnect_later') THEN
    -- first 1 BD after contact, then every 2 BD for up to 10 BD → slots at 1,3,5,7,9
    IF c > 4 THEN RETURN NULL; END IF;
    due := public.add_business_days(entered, 1 + c * 2);

  ELSIF p_status IN ('demo_booked', 'demo_needs_reschedule') THEN
    IF p_demo_at IS NULL THEN
      -- Ask the team to confirm a demo time.
      IF c > 0 THEN RETURN NULL; END IF;
      due := public.add_business_days(entered, 1);
    ELSIF p_demo_at > now() THEN
      IF c > 0 THEN RETURN NULL; END IF; -- only the pre-demo reminder while future demo exists
      due := public.add_business_days(p_demo_at, -1);
      IF due < entered THEN due := entered; END IF;
    ELSE
      -- Demo time has passed; same-business-day follow-up, no recurring after that until completed+rescheduled.
      IF c > 0 THEN RETURN NULL; END IF;
      due := public.roll_to_business_hours(GREATEST(p_demo_at, now()));
    END IF;

  ELSIF p_status IN ('demo_completed', 'demo_completed_didnt_sign_up', 'follow_up_after_demo') THEN
    -- 1 BD after, every 2 BD for 10 BD (1,3,5,7,9), then weekly for 2 weeks
    IF c <= 4 THEN
      due := public.add_business_days(entered, 1 + c * 2);
    ELSIF c <= 6 THEN
      due := public.roll_to_business_hours(public.add_business_days(entered, 10) + ((c - 4) * interval '7 days'));
    ELSE
      RETURN NULL;
    END IF;

  ELSIF p_status IN ('signed_up', 'demo_completed_signed_up') THEN
    IF c = 0 THEN
      due := public.add_business_days(entered, 1);
    ELSIF c <= 4 THEN
      due := public.add_business_days(entered, 1 + c); -- daily for 5 BD total after first
    ELSE
      due := public.add_business_days(entered, 5 + (c - 4) * 2); -- every 2 BD until onboarding submitted
    END IF;

  ELSIF p_status IN ('onboarding_submitted', 'signup_submitted', 'bank_account_connected') THEN
    is_internal := true;
    due := public.add_business_days(entered, 2 + c); -- wait 2 BD, then daily

  ELSIF p_status IN ('onboarding_approved', 'onboarding_done', 'ready_for_first_application') THEN
    -- first at 3 BD, every 3 BD while within the first 2 weeks, then weekly (monotonic, no backward jumps).
    DECLARE
      i int;
      t timestamptz := entered;
      day14 date := (entered AT TIME ZONE public.follow_up_tz())::date + 14;
      weekly_count int := 0;
      candidate timestamptz;
    BEGIN
      FOR i IN 0..c LOOP
        IF weekly_count = 0 THEN
          candidate := public.add_business_days(entered, 3 * (i + 1));
          IF (candidate AT TIME ZONE public.follow_up_tz())::date <= day14 THEN
            t := candidate;
          ELSE
            weekly_count := 1;
            t := public.roll_to_business_hours(
              (day14::timestamp + time '08:00') AT TIME ZONE public.follow_up_tz()
            );
          END IF;
        ELSE
          weekly_count := weekly_count + 1;
          t := public.roll_to_business_hours(
            (day14::timestamp + time '08:00') AT TIME ZONE public.follow_up_tz()
            + ((weekly_count - 1) * interval '7 days')
          );
        END IF;
      END LOOP;
      due := t;
    END;

  ELSIF p_status IN ('first_case_funded', 'completed_first_application') THEN
    IF c = 0 THEN
      due := public.roll_to_business_hours(entered + interval '7 days');
    ELSE
      due := public.roll_to_business_hours(entered + interval '7 days' + (c * interval '7 days'));
    END IF;

  ELSE
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'due_at', due,
    'skip_roll', skip_roll,
    'is_internal', is_internal
  );
END;
$$;

-- =============================================
-- Cadence: applications
-- =============================================
CREATE OR REPLACE FUNCTION public.compute_application_follow_up_due(
  p_status text,
  p_entered_at timestamptz,
  p_count int,
  p_last_activity_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  due timestamptz;
  skip_roll boolean := false;
  is_internal boolean := false;
  c int := GREATEST(p_count, 0);
  entered timestamptz := COALESCE(p_entered_at, now());
  last_act timestamptz := COALESCE(p_last_activity_at, entered);
  day14 date;
BEGIN
  IF p_status IN ('no_offers_available', 'no_offers', 'funded', 'application_withdrawn', 'cancelled', 'paid_to_firm') THEN
    RETURN NULL;
  END IF;

  IF p_status IN ('application_invite_sent', 'link_sent') THEN
    due := entered + ((c + 1) * interval '12 hours');
    is_internal := false;

  ELSIF p_status IN ('application_incomplete', 'application_started', 'submitted') THEN
    day14 := (last_act AT TIME ZONE public.follow_up_tz())::date + 14;
    IF c = 0 THEN
      due := last_act + interval '12 hours';
    ELSIF c <= 5 THEN
      due := last_act + interval '12 hours' + (c * interval '24 hours');
    ELSE
      due := last_act + interval '12 hours' + interval '5 days' + ((c - 5) * interval '48 hours');
    END IF;
    IF (due AT TIME ZONE public.follow_up_tz())::date > day14 THEN
      RETURN NULL;
    END IF;

  ELSIF p_status IN ('offer_selection_needed', 'offers_available') THEN
    skip_roll := true;
    IF c = 0 THEN
      due := entered; -- instant
    ELSIF c <= 4 THEN
      due := public.next_morning_pt(entered, c);
      skip_roll := true; -- already 8am PT
    ELSE
      RETURN NULL;
    END IF;

  ELSIF p_status IN ('client_declined_offers', 'declined') THEN
    IF c > 0 THEN RETURN NULL; END IF;
    due := entered + interval '24 hours';

  ELSIF p_status IN ('offer_processing', 'client_selected_offer', 'approved') THEN
    is_internal := true;
    due := entered + ((c + 1) * interval '24 hours');

  ELSIF p_status IN ('funds_in_transit') THEN
    is_internal := true;
    IF c = 0 THEN
      due := public.add_business_days(entered, 2);
    ELSE
      due := public.add_business_days(entered, 2 + c);
    END IF;

  ELSIF p_status IN ('error', 'issue_stuck') THEN
    is_internal := true;
    skip_roll := (c = 0);
    IF c = 0 THEN
      due := entered; -- immediate
    ELSE
      due := public.add_business_hours(entered, 4 * c);
    END IF;

  ELSE
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'due_at', due,
    'skip_roll', skip_roll,
    'is_internal', is_internal
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.follow_up_copy(p_kind text, p_status text, p_name text, p_internal boolean)
RETURNS jsonb
LANGUAGE sql IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'title',
      CASE
        WHEN p_kind = 'application' AND p_status IN ('error', 'issue_stuck') THEN 'Application error: ' || COALESCE(NULLIF(p_name, ''), 'Unknown client')
        WHEN p_kind = 'application' THEN 'Follow-up due: ' || COALESCE(NULLIF(p_name, ''), 'Unknown client')
        ELSE 'Follow-up due: ' || COALESCE(NULLIF(p_name, ''), 'Unknown firm')
      END,
    'message',
      CASE
        WHEN p_internal THEN
          'Internal review for status "' || replace(p_status, '_', ' ') || '". Do not contact the attorney/client unless they need to take action.'
        ELSE
          'Status is "' || replace(p_status, '_', ' ') || '". Complete this follow-up, then the next one will be scheduled from the normal cadence.'
      END
  )
$$;

-- =============================================
-- Recipients
-- =============================================
CREATE OR REPLACE FUNCTION public.follow_up_recipient_ids(p_assigned_to uuid, p_kind text, p_escalated boolean)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  ids uuid[] := ARRAY[]::uuid[];
  extra uuid[];
BEGIN
  IF p_assigned_to IS NOT NULL THEN
    ids := ids || p_assigned_to;
  END IF;

  IF p_assigned_to IS NULL OR p_escalated THEN
    IF p_kind = 'sales' THEN
      SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[]) INTO extra
      FROM public.user_roles
      WHERE role IN ('super_admin', 'admin', 'sales_team_lead', 'sales');
    ELSE
      SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[]) INTO extra
      FROM public.user_roles
      WHERE role IN ('super_admin', 'admin', 'operations_team_lead', 'operations');
    END IF;
    ids := ids || extra;
  ELSIF p_escalated AND p_kind = 'application' THEN
    SELECT COALESCE(array_agg(DISTINCT user_id), ARRAY[]::uuid[]) INTO extra
    FROM public.user_roles
    WHERE role IN ('super_admin', 'admin', 'operations_team_lead');
    ids := ids || extra;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO ids FROM unnest(ids) t(x);
  RETURN ids;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_auto_follow_ups(p_kind text, p_firm_id uuid, p_session text)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.follow_ups
     SET status = 'cancelled', cancelled_at = now()
   WHERE source = 'automatic'
     AND status IN ('pending', 'notified')
     AND kind = p_kind
     AND (
       (p_kind = 'sales' AND firm_id = p_firm_id)
       OR (p_kind = 'application' AND platform_session_id = p_session)
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_firm_next_follow_up(p_firm_id uuid)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  nxt timestamptz;
BEGIN
  SELECT MIN(due_at) INTO nxt
  FROM public.follow_ups
  WHERE firm_id = p_firm_id
    AND status IN ('pending', 'notified');
  UPDATE public.firms
     SET next_follow_up_date = nxt::date
   WHERE id = p_firm_id
     AND next_follow_up_date IS DISTINCT FROM nxt::date;
END;
$$;

-- =============================================
-- Schedule helpers
-- =============================================
CREATE OR REPLACE FUNCTION public.schedule_sales_follow_up(p_firm_id uuid, p_force_reset boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f public.firms%ROWTYPE;
  pipe text;
  spec jsonb;
  due timestamptz;
  skip_roll boolean;
  is_internal boolean;
  copy jsonb;
  new_id uuid;
  assignee uuid;
BEGIN
  SELECT * INTO f FROM public.firms WHERE id = p_firm_id;
  IF NOT FOUND OR f.archived THEN
    RETURN NULL;
  END IF;

  pipe := public.firm_pipeline_status(f.sales_status, f.onboarding_status);

  IF p_force_reset THEN
    PERFORM public.cancel_auto_follow_ups('sales', p_firm_id, NULL);
  ELSIF EXISTS (
    SELECT 1 FROM public.follow_ups
     WHERE kind = 'sales' AND source = 'automatic' AND firm_id = p_firm_id
       AND status IN ('pending', 'notified')
  ) THEN
    PERFORM public.sync_firm_next_follow_up(p_firm_id);
    RETURN NULL;
  END IF;

  spec := public.compute_sales_follow_up_due(
    pipe,
    f.pipeline_status_entered_at,
    f.auto_follow_up_count,
    f.promised_follow_up_at,
    f.demo_scheduled_at,
    f.reconnect_date
  );
  IF spec IS NULL OR spec->>'due_at' IS NULL THEN
    PERFORM public.sync_firm_next_follow_up(p_firm_id);
    RETURN NULL;
  END IF;

  due := (spec->>'due_at')::timestamptz;
  skip_roll := COALESCE((spec->>'skip_roll')::boolean, false);
  is_internal := COALESCE((spec->>'is_internal')::boolean, false);
  due := public.roll_to_business_hours(due, skip_roll);

  copy := public.follow_up_copy('sales', pipe, f.name, is_internal);
  assignee := f.assigned_account_manager;

  INSERT INTO public.follow_ups (
    kind, source, status, pipeline_status, sequence_index, due_at,
    is_internal, skip_business_hours, title, message,
    firm_id, assigned_to
  ) VALUES (
    'sales', 'automatic', 'pending', pipe, f.auto_follow_up_count, due,
    is_internal, skip_roll, copy->>'title', copy->>'message',
    p_firm_id, assignee
  )
  RETURNING id INTO new_id;

  PERFORM public.sync_firm_next_follow_up(p_firm_id);
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_application_follow_up(p_session text, p_force_reset boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.platform_applications%ROWTYPE;
  spec jsonb;
  due timestamptz;
  skip_roll boolean;
  is_internal boolean;
  copy jsonb;
  new_id uuid;
BEGIN
  SELECT * INTO a FROM public.platform_applications WHERE session_id = p_session;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF p_force_reset THEN
    PERFORM public.cancel_auto_follow_ups('application', NULL, p_session);
  ELSIF EXISTS (
    SELECT 1 FROM public.follow_ups
     WHERE kind = 'application' AND source = 'automatic' AND platform_session_id = p_session
       AND status IN ('pending', 'notified')
  ) THEN
    RETURN NULL;
  END IF;

  spec := public.compute_application_follow_up_due(
    a.substatus, a.substatus_entered_at, a.auto_follow_up_count, a.last_activity_at
  );
  IF spec IS NULL OR spec->>'due_at' IS NULL THEN
    RETURN NULL;
  END IF;

  due := public.roll_to_business_hours((spec->>'due_at')::timestamptz, COALESCE((spec->>'skip_roll')::boolean, false));
  skip_roll := COALESCE((spec->>'skip_roll')::boolean, false);
  is_internal := COALESCE((spec->>'is_internal')::boolean, false);
  copy := public.follow_up_copy('application', a.substatus, a.client_name, is_internal);

  INSERT INTO public.follow_ups (
    kind, source, status, pipeline_status, sequence_index, due_at,
    is_internal, skip_business_hours, title, message,
    firm_id, platform_session_id, assigned_to
  ) VALUES (
    'application', 'automatic', 'pending', a.substatus, a.auto_follow_up_count, due,
    is_internal, skip_roll, copy->>'title', copy->>'message',
    a.firm_id, p_session, a.assigned_to
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- =============================================
-- Fire due follow-ups into notifications
-- =============================================
CREATE OR REPLACE FUNCTION public.process_due_follow_ups(p_limit int DEFAULT 200)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.follow_ups%ROWTYPE;
  uid uuid;
  n_id uuid;
  fired int := 0;
  recipients uuid[];
  app_row public.platform_applications%ROWTYPE;
  title text;
  escalated boolean := false;
BEGIN
  -- If a future-demo reminder is still pending after the demo time, reschedule as missed-demo.
  PERFORM public.schedule_sales_follow_up(f.id, true)
    FROM public.firms f
   WHERE f.sales_status = 'demo_booked'
     AND f.demo_scheduled_at IS NOT NULL
     AND f.demo_scheduled_at <= now()
     AND EXISTS (
       SELECT 1 FROM public.follow_ups fu
        WHERE fu.firm_id = f.id AND fu.kind = 'sales' AND fu.source = 'automatic'
          AND fu.status = 'pending' AND fu.due_at < f.demo_scheduled_at
     );

  FOR rec IN
    SELECT *
      FROM public.follow_ups
     WHERE status = 'pending'
       AND due_at <= now()
     ORDER BY due_at
     LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    recipients := public.follow_up_recipient_ids(rec.assigned_to, rec.kind, false);
    title := rec.title;

    IF rec.kind = 'application' AND rec.pipeline_status IN ('error', 'issue_stuck') THEN
      SELECT * INTO app_row FROM public.platform_applications WHERE session_id = rec.platform_session_id;
      IF FOUND AND now() >= public.add_business_days(app_row.substatus_entered_at, 1) THEN
        escalated := true;
        title := 'ESCALATED: ' || rec.title;
        UPDATE public.platform_applications SET escalated = true WHERE session_id = rec.platform_session_id;
        recipients := public.follow_up_recipient_ids(rec.assigned_to, rec.kind, true);
      END IF;
    END IF;

    IF recipients IS NULL OR array_length(recipients, 1) IS NULL THEN
      -- Nobody to notify; still mark notified so it surfaces on Follow Ups Due.
      UPDATE public.follow_ups SET status = 'notified' WHERE id = rec.id;
      fired := fired + 1;
      CONTINUE;
    END IF;

    n_id := NULL;
    FOREACH uid IN ARRAY recipients LOOP
      INSERT INTO public.notifications (user_id, type, title, message, firm_id, follow_up_id, platform_session_id)
      VALUES (
        uid,
        CASE WHEN rec.is_internal THEN 'follow_up_internal' ELSE 'follow_up_due' END,
        title,
        rec.message,
        rec.firm_id,
        rec.id,
        rec.platform_session_id
      )
      RETURNING id INTO n_id;
    END LOOP;

    UPDATE public.follow_ups
       SET status = 'notified', notification_id = n_id
     WHERE id = rec.id;

    IF rec.kind = 'sales' AND rec.firm_id IS NOT NULL THEN
      UPDATE public.firms
         SET auto_follow_up_count = GREATEST(auto_follow_up_count, rec.sequence_index + 1)
       WHERE id = rec.firm_id;
    ELSIF rec.kind = 'application' AND rec.platform_session_id IS NOT NULL THEN
      UPDATE public.platform_applications
         SET auto_follow_up_count = GREATEST(auto_follow_up_count, rec.sequence_index + 1)
       WHERE session_id = rec.platform_session_id;
    END IF;

    fired := fired + 1;
  END LOOP;

  RETURN fired;
END;
$$;

-- =============================================
-- Complete + manual + promised date
-- =============================================
CREATE OR REPLACE FUNCTION public.complete_follow_up(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.follow_ups%ROWTYPE;
BEGIN
  SELECT * INTO rec FROM public.follow_ups WHERE id = _id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up not found';
  END IF;
  IF rec.status IN ('completed', 'cancelled') THEN
    RETURN;
  END IF;

  UPDATE public.follow_ups
     SET status = 'completed',
         completed_at = now(),
         completed_by = auth.uid()
   WHERE id = _id;

  IF rec.source <> 'automatic' THEN
    IF rec.kind = 'sales' THEN
      PERFORM public.sync_firm_next_follow_up(rec.firm_id);
    END IF;
    RETURN;
  END IF;

  IF rec.kind = 'sales' THEN
    UPDATE public.firms
       SET auto_follow_up_count = GREATEST(auto_follow_up_count, rec.sequence_index + 1),
           promised_follow_up_at = NULL,
           reconnect_date = NULL
     WHERE id = rec.firm_id;
    PERFORM public.schedule_sales_follow_up(rec.firm_id, false);
    PERFORM public.process_due_follow_ups(20);
  ELSE
    UPDATE public.platform_applications
       SET auto_follow_up_count = GREATEST(auto_follow_up_count, rec.sequence_index + 1)
     WHERE session_id = rec.platform_session_id;
    PERFORM public.schedule_application_follow_up(rec.platform_session_id, false);
    PERFORM public.process_due_follow_ups(20);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_promised_follow_up(p_firm_id uuid, p_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.firms
     SET promised_follow_up_at = p_at,
         next_follow_up_date = p_at::date,
         reconnect_date = CASE WHEN p_at IS NULL THEN reconnect_date ELSE p_at::date END
   WHERE id = p_firm_id;
  PERFORM public.schedule_sales_follow_up(p_firm_id, true);
  PERFORM public.process_due_follow_ups(20);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manual_follow_up(
  p_kind text,
  p_firm_id uuid,
  p_session text,
  p_due_at timestamptz,
  p_title text DEFAULT NULL,
  p_message text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  due timestamptz;
  title text;
  msg text;
  assignee uuid;
  pipe text;
  fname text;
BEGIN
  due := public.roll_to_business_hours(COALESCE(p_due_at, now()));
  IF p_kind = 'sales' THEN
    SELECT assigned_account_manager, public.firm_pipeline_status(sales_status, onboarding_status), name
      INTO assignee, pipe, fname
      FROM public.firms WHERE id = p_firm_id;
    title := COALESCE(NULLIF(p_title, ''), 'Manual follow-up: ' || COALESCE(fname, 'Firm'));
    msg := COALESCE(p_message, 'Manually scheduled follow-up.');
    INSERT INTO public.follow_ups (
      kind, source, status, pipeline_status, sequence_index, due_at,
      title, message, firm_id, assigned_to
    ) VALUES (
      'sales', 'manual', 'pending', COALESCE(pipe, 'manual'), 0, due,
      title, msg, p_firm_id, assignee
    ) RETURNING id INTO new_id;
    PERFORM public.sync_firm_next_follow_up(p_firm_id);
  ELSE
    SELECT assigned_to, substatus, client_name
      INTO assignee, pipe, fname
      FROM public.platform_applications WHERE session_id = p_session;
    title := COALESCE(NULLIF(p_title, ''), 'Manual follow-up: ' || COALESCE(fname, 'Application'));
    msg := COALESCE(p_message, 'Manually scheduled follow-up.');
    INSERT INTO public.follow_ups (
      kind, source, status, pipeline_status, sequence_index, due_at,
      title, message, platform_session_id, assigned_to, firm_id
    ) VALUES (
      'application', 'manual', 'pending', COALESCE(pipe, 'manual'), 0, due,
      title, msg, p_session, assignee, p_firm_id
    ) RETURNING id INTO new_id;
  END IF;
  PERFORM public.process_due_follow_ups(20);
  RETURN new_id;
END;
$$;

-- =============================================
-- Triggers
-- =============================================
CREATE OR REPLACE FUNCTION public.trg_firms_pipeline_before()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_pipe text;
  new_pipe text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.pipeline_status_entered_at := COALESCE(NEW.pipeline_status_entered_at, now());
    NEW.auto_follow_up_count := 0;
    RETURN NEW;
  END IF;
  old_pipe := public.firm_pipeline_status(OLD.sales_status, OLD.onboarding_status);
  new_pipe := public.firm_pipeline_status(NEW.sales_status, NEW.onboarding_status);
  IF old_pipe IS DISTINCT FROM new_pipe THEN
    NEW.pipeline_status_entered_at := now();
    NEW.auto_follow_up_count := 0;
    NEW.promised_follow_up_at := NULL;
    NEW.reconnect_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_firms_pipeline_after()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  force_reset boolean := false;
  old_pipe text;
  new_pipe text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    force_reset := true;
  ELSE
    old_pipe := public.firm_pipeline_status(OLD.sales_status, OLD.onboarding_status);
    new_pipe := public.firm_pipeline_status(NEW.sales_status, NEW.onboarding_status);
    force_reset :=
      old_pipe IS DISTINCT FROM new_pipe
      OR NEW.promised_follow_up_at IS DISTINCT FROM OLD.promised_follow_up_at
      OR NEW.reconnect_date IS DISTINCT FROM OLD.reconnect_date
      OR NEW.demo_scheduled_at IS DISTINCT FROM OLD.demo_scheduled_at;
  END IF;

  PERFORM public.schedule_sales_follow_up(NEW.id, force_reset);

  -- Immediate notify when a new lead is first assigned.
  IF TG_OP = 'UPDATE'
     AND NEW.assigned_account_manager IS DISTINCT FROM OLD.assigned_account_manager
     AND NEW.assigned_account_manager IS NOT NULL THEN
    UPDATE public.follow_ups
       SET assigned_to = NEW.assigned_account_manager
     WHERE firm_id = NEW.id AND status IN ('pending', 'notified');
  END IF;

  PERFORM public.process_due_follow_ups(20);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_firms_pipeline_before ON public.firms;
CREATE TRIGGER trg_firms_pipeline_before
  BEFORE INSERT OR UPDATE OF sales_status, onboarding_status
  ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.trg_firms_pipeline_before();

DROP TRIGGER IF EXISTS trg_firms_pipeline_after ON public.firms;
CREATE TRIGGER trg_firms_pipeline_after
  AFTER INSERT OR UPDATE OF sales_status, onboarding_status, assigned_account_manager,
    promised_follow_up_at, reconnect_date, demo_scheduled_at
  ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.trg_firms_pipeline_after();

CREATE OR REPLACE FUNCTION public.trg_calendar_sync_demo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  fid uuid;
  nxt timestamptz;
BEGIN
  fid := COALESCE(NEW.firm_id, OLD.firm_id);
  IF fid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT MIN(start_at) INTO nxt
  FROM public.calendar_events
  WHERE firm_id = fid
    AND event_type = 'demo'
    AND status <> 'cancelled'
    AND start_at >= now() - interval '12 hours';
  UPDATE public.firms
     SET demo_scheduled_at = nxt
   WHERE id = fid
     AND demo_scheduled_at IS DISTINCT FROM nxt;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_sync_demo ON public.calendar_events;
CREATE TRIGGER trg_calendar_sync_demo
  AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.trg_calendar_sync_demo();

CREATE OR REPLACE FUNCTION public.trg_platform_apps_follow_up()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.substatus IS DISTINCT FROM OLD.substatus THEN
    NEW.substatus_entered_at := now();
    NEW.auto_follow_up_count := 0;
    NEW.escalated := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_apps_follow_up_before ON public.platform_applications;
CREATE TRIGGER trg_platform_apps_follow_up_before
  BEFORE INSERT OR UPDATE OF substatus ON public.platform_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_platform_apps_follow_up();

CREATE OR REPLACE FUNCTION public.trg_platform_apps_follow_up_after()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  force_reset boolean;
BEGIN
  force_reset := TG_OP = 'INSERT' OR NEW.substatus IS DISTINCT FROM OLD.substatus
    OR (NEW.substatus IN ('application_incomplete', 'application_started')
        AND NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at
        AND NEW.auto_follow_up_count = 0);
  PERFORM public.schedule_application_follow_up(NEW.session_id, force_reset);
  PERFORM public.process_due_follow_ups(20);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_apps_follow_up_after ON public.platform_applications;
CREATE TRIGGER trg_platform_apps_follow_up_after
  AFTER INSERT OR UPDATE OF substatus, last_activity_at, assigned_to
  ON public.platform_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_platform_apps_follow_up_after();

-- =============================================
-- Grants
-- =============================================
GRANT SELECT, INSERT, UPDATE ON public.follow_ups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_applications TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_follow_up(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_promised_follow_up(uuid, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_follow_up(text, uuid, text, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_follow_ups(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_sales_follow_up(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_application_follow_up(text, boolean) TO authenticated;

-- =============================================
-- Backfill existing firms (next future/overdue slot only — no notification spam)
-- =============================================
DO $$
DECLARE
  r record;
  spec jsonb;
  c int;
  due timestamptz;
  chosen int;
BEGIN
  FOR r IN SELECT * FROM public.firms WHERE NOT archived LOOP
    chosen := NULL;
    FOR c IN 0..20 LOOP
      spec := public.compute_sales_follow_up_due(
        public.firm_pipeline_status(r.sales_status, r.onboarding_status),
        COALESCE(r.pipeline_status_entered_at, r.created_at),
        c,
        r.promised_follow_up_at,
        r.demo_scheduled_at,
        r.reconnect_date
      );
      EXIT WHEN spec IS NULL;
      due := (spec->>'due_at')::timestamptz;
      IF due >= now() - interval '5 seconds' THEN
        chosen := c;
        EXIT;
      END IF;
      chosen := c; -- keep last overdue as fallback
    END LOOP;
    IF chosen IS NOT NULL THEN
      UPDATE public.firms SET auto_follow_up_count = chosen WHERE id = r.id;
      PERFORM public.schedule_sales_follow_up(r.id, true);
    END IF;
  END LOOP;
END $$;
