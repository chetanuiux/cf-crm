CREATE OR REPLACE FUNCTION public.validate_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  -- No assignment, or self-assignment, always allowed
  IF NEW.assigned_to IS NULL OR NEW.assigned_to = actor THEN
    RETURN NEW;
  END IF;

  -- Admins / super admins can assign to anyone
  IF public.is_admin(actor) THEN
    RETURN NEW;
  END IF;

  -- Sales team lead -> can assign to sales or sales_team_lead
  IF public.has_role(actor, 'sales_team_lead'::app_role) THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.assigned_to
        AND role IN ('sales'::app_role, 'sales_team_lead'::app_role)
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Operations team lead -> can assign to operations or operations_team_lead
  IF public.has_role(actor, 'operations_team_lead'::app_role) THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.assigned_to
        AND role IN ('operations'::app_role, 'operations_team_lead'::app_role)
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'You do not have permission to assign tasks to this user';
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_assignment ON public.tasks;
CREATE TRIGGER trg_validate_task_assignment
BEFORE INSERT OR UPDATE OF assigned_to ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_assignment();