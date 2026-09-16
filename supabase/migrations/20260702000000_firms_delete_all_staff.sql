-- Allow all staff roles except 'support' (read-only) to hard-delete firms.
-- Previously restricted to admin/super_admin + team leads (sales_team_lead, operations_team_lead).

CREATE OR REPLACE FUNCTION public.can_delete_firm(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role <> 'support'::app_role
  )
$$;

DROP POLICY IF EXISTS firms_delete ON public.firms;
CREATE POLICY firms_delete ON public.firms
  FOR DELETE TO authenticated
  USING (public.can_delete_firm(auth.uid()));

-- Extend the 3-per-24h rate limit (previously manager-only) to all non-admin staff who can now delete.
CREATE OR REPLACE FUNCTION public.enforce_firm_delete_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  recent int;
BEGIN
  IF public.is_admin(actor) THEN
    -- no limit
    NULL;
  ELSIF public.can_delete_firm(actor) THEN
    recent := public.firm_deletions_last_24h(actor);
    IF recent >= 3 THEN
      RAISE EXCEPTION 'Daily firm deletion limit reached. Staff can delete up to 3 firms per 24 hours. Try again later.'
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
