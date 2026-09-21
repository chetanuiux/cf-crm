-- The casefunders.com CRM feed is being extended to also return client-started
-- applications (it only returned attorney-started ones before). Those will arrive
-- in bulk and have no attorney/firm, so they would all create unassigned
-- follow-ups that notify every admin/operations user.
--
-- Record who started each application, and keep client-started applications out of
-- the automatic follow-up engine until a rep is assigned.
--
-- Apply this BEFORE deploying the process-follow-ups edge function that writes
-- started_by, otherwise its upserts fail on the unknown column.

ALTER TABLE public.platform_applications ADD COLUMN IF NOT EXISTS started_by TEXT;

-- Everything synced so far came from the attorney-only feed.
UPDATE public.platform_applications SET started_by = 'attorney' WHERE started_by IS NULL;

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

  -- Only attorney-started applications get automatic follow-ups. Anything else
  -- (client-started, or not yet known) waits until a rep is assigned.
  IF lower(COALESCE(a.started_by, '')) <> 'attorney' AND a.assigned_to IS NULL THEN
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

-- Also re-run scheduling when started_by is filled in, so an attorney-started
-- application synced before started_by was written still gets its follow-up.
DROP TRIGGER IF EXISTS trg_platform_apps_follow_up_after ON public.platform_applications;
CREATE TRIGGER trg_platform_apps_follow_up_after
  AFTER INSERT OR UPDATE OF substatus, last_activity_at, assigned_to, started_by
  ON public.platform_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_platform_apps_follow_up_after();
