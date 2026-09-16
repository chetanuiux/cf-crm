
-- Auto-bump firms.last_activity_date whenever something changes on a firm

CREATE OR REPLACE FUNCTION public.bump_firm_activity(_firm_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.firms SET last_activity_date = now() WHERE id = _firm_id;
$$;

-- 1) Any update to firms itself
CREATE OR REPLACE FUNCTION public.firms_touch_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Avoid infinite loop: only set if not already being set to now() in this update
  IF NEW.last_activity_date IS NOT DISTINCT FROM OLD.last_activity_date THEN
    NEW.last_activity_date := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS firms_touch_activity_trg ON public.firms;
CREATE TRIGGER firms_touch_activity_trg
BEFORE UPDATE ON public.firms
FOR EACH ROW EXECUTE FUNCTION public.firms_touch_activity();

-- 2) Notes related to a firm
CREATE OR REPLACE FUNCTION public.notes_bump_firm_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _firm_id uuid;
BEGIN
  IF NEW.related_record_type = 'firm' THEN
    PERFORM public.bump_firm_activity(NEW.related_record_id);
  ELSIF NEW.related_record_type = 'application' THEN
    SELECT firm_id INTO _firm_id FROM public.client_applications WHERE id = NEW.related_record_id;
    IF _firm_id IS NOT NULL THEN PERFORM public.bump_firm_activity(_firm_id); END IF;
  ELSIF NEW.related_record_type = 'contact' THEN
    SELECT firm_id INTO _firm_id FROM public.firm_contacts WHERE id = NEW.related_record_id;
    IF _firm_id IS NOT NULL THEN PERFORM public.bump_firm_activity(_firm_id); END IF;
  ELSIF NEW.related_record_type = 'payment' THEN
    SELECT firm_id INTO _firm_id FROM public.payments WHERE id = NEW.related_record_id;
    IF _firm_id IS NOT NULL THEN PERFORM public.bump_firm_activity(_firm_id); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_bump_firm_activity_trg ON public.notes;
CREATE TRIGGER notes_bump_firm_activity_trg
AFTER INSERT OR UPDATE ON public.notes
FOR EACH ROW EXECUTE FUNCTION public.notes_bump_firm_activity();

-- 3) Client applications
CREATE OR REPLACE FUNCTION public.apps_bump_firm_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.firm_id IS NOT NULL THEN PERFORM public.bump_firm_activity(NEW.firm_id); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apps_bump_firm_activity_trg ON public.client_applications;
CREATE TRIGGER apps_bump_firm_activity_trg
AFTER INSERT OR UPDATE ON public.client_applications
FOR EACH ROW EXECUTE FUNCTION public.apps_bump_firm_activity();

-- 4) Payments
CREATE OR REPLACE FUNCTION public.payments_bump_firm_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.firm_id IS NOT NULL THEN PERFORM public.bump_firm_activity(NEW.firm_id); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_bump_firm_activity_trg ON public.payments;
CREATE TRIGGER payments_bump_firm_activity_trg
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.payments_bump_firm_activity();

-- 5) Firm contacts
CREATE OR REPLACE FUNCTION public.contacts_bump_firm_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.firm_id IS NOT NULL THEN PERFORM public.bump_firm_activity(NEW.firm_id); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_bump_firm_activity_trg ON public.firm_contacts;
CREATE TRIGGER contacts_bump_firm_activity_trg
AFTER INSERT OR UPDATE ON public.firm_contacts
FOR EACH ROW EXECUTE FUNCTION public.contacts_bump_firm_activity();

-- 6) Tasks attached to a firm
CREATE OR REPLACE FUNCTION public.tasks_bump_firm_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.firm_id IS NOT NULL THEN PERFORM public.bump_firm_activity(NEW.firm_id); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_bump_firm_activity_trg ON public.tasks;
CREATE TRIGGER tasks_bump_firm_activity_trg
AFTER INSERT OR UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_bump_firm_activity();
