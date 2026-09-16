
-- Helper: is_manager (sales_team_lead or operations_team_lead)
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('sales_team_lead'::app_role, 'operations_team_lead'::app_role)
  )
$$;

-- Helper: count of firm deletions by a user in the last 24 hours
CREATE OR REPLACE FUNCTION public.firm_deletions_last_24h(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.activity_logs
  WHERE performed_by = _user_id
    AND action_type = 'firm_deleted'
    AND created_at > (now() - interval '24 hours')
$$;

-- Trigger: enforce manager rate limit and log deletion
CREATE OR REPLACE FUNCTION public.enforce_firm_delete_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  recent int;
BEGIN
  IF public.is_admin(actor) THEN
    -- no limit
    NULL;
  ELSIF public.is_manager(actor) THEN
    recent := public.firm_deletions_last_24h(actor);
    IF recent >= 3 THEN
      RAISE EXCEPTION 'Daily firm deletion limit reached. Managers can delete up to 3 firms per 24 hours. Try again later.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSE
    RAISE EXCEPTION 'You do not have permission to delete firms.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.activity_logs (action_type, description, related_record_type, related_record_id, performed_by, metadata)
  VALUES ('firm_deleted', 'Firm deleted: ' || COALESCE(OLD.name, OLD.id::text), 'firm', OLD.id, actor,
          jsonb_build_object('firm_name', OLD.name));
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_firm_delete_limit ON public.firms;
CREATE TRIGGER trg_enforce_firm_delete_limit
  BEFORE DELETE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.enforce_firm_delete_limit();

-- Update RLS policy: admins or managers can attempt; trigger enforces limit
DROP POLICY IF EXISTS firms_delete ON public.firms;
CREATE POLICY firms_delete ON public.firms
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_manager(auth.uid()));
