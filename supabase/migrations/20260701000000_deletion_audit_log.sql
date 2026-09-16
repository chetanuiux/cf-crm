-- =============================================
-- Deletion Audit Log: trigger-based logging for
-- lead dismissal and firm archiving (soft deletes).
-- Hard firm delete already logs via enforce_firm_delete_limit (action_type='firm_deleted').
-- =============================================

-- Trigger: log lead dismissal ("delete lead" in the UI)
CREATE OR REPLACE FUNCTION public.log_lead_dismissed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'dismissed' AND OLD.status IS DISTINCT FROM 'dismissed' THEN
    INSERT INTO public.activity_logs (action_type, description, related_record_type, related_record_id, performed_by, metadata)
    VALUES (
      'lead_dismissed',
      'Lead deleted: ' || COALESCE(NEW.name, NEW.email, NEW.id::text),
      'lead', NEW.id, auth.uid(),
      jsonb_build_object('lead_name', NEW.name, 'lead_email', NEW.email)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_dismissed ON public.leads;
CREATE TRIGGER trg_log_lead_dismissed
  AFTER UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_dismissed();

-- Trigger: log firm archive ("delete firm" from the Firms list)
CREATE OR REPLACE FUNCTION public.log_firm_archived()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.archived = true AND OLD.archived IS DISTINCT FROM true THEN
    INSERT INTO public.activity_logs (action_type, description, related_record_type, related_record_id, performed_by, metadata)
    VALUES (
      'firm_archived',
      'Firm deleted: ' || COALESCE(NEW.name, NEW.id::text),
      'firm', NEW.id, auth.uid(),
      jsonb_build_object('firm_name', NEW.name, 'firm_email', NEW.email)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_firm_archived ON public.firms;
CREATE TRIGGER trg_log_firm_archived
  AFTER UPDATE ON public.firms
  FOR EACH ROW EXECUTE FUNCTION public.log_firm_archived();
