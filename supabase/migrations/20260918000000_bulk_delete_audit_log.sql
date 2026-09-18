-- Audit logging for hard deletes of leads and follow-ups, used by the
-- Super Admin-only bulk delete feature in the Leads / Follow Ups Due lists.
-- Firms already get bulk-delete audit logging for free via
-- enforce_firm_delete_limit (BEFORE DELETE, FOR EACH ROW, logs 'firm_deleted').
-- RLS for both tables already restricts DELETE to is_admin() (super_admin/admin);
-- the bulk-delete UI further restricts this to isSuperAdmin only.

CREATE OR REPLACE FUNCTION public.log_lead_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs (action_type, description, related_record_type, related_record_id, performed_by, metadata)
  VALUES (
    'lead_deleted',
    'Lead permanently deleted: ' || COALESCE(OLD.name, OLD.email, OLD.id::text),
    'lead', OLD.id, auth.uid(),
    jsonb_build_object('lead_name', OLD.name, 'lead_email', OLD.email)
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_lead_deleted ON public.leads;
CREATE TRIGGER trg_log_lead_deleted
  AFTER DELETE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.log_lead_deleted();

CREATE OR REPLACE FUNCTION public.log_follow_up_deleted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs (action_type, description, related_record_type, related_record_id, performed_by, metadata)
  VALUES (
    'follow_up_deleted',
    'Follow-up permanently deleted: ' || COALESCE(OLD.title, OLD.id::text),
    'follow_up', OLD.id, auth.uid(),
    jsonb_build_object('title', OLD.title, 'kind', OLD.kind)
  );
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_follow_up_deleted ON public.follow_ups;
CREATE TRIGGER trg_log_follow_up_deleted
  AFTER DELETE ON public.follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.log_follow_up_deleted();
