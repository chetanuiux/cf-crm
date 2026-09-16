-- Split the single admin-only leads UPDATE policy into two:
--   1. leads_update_admin  — admins can update any field (convert, dismiss, etc.)
--   2. leads_convert       — non-admin, non-support roles may only set status='converted'
--
-- DELETE on leads remains admin-only (existing leads_delete policy is unchanged).
-- Supabase evaluates permissive policies with OR, so a user needs to satisfy
-- at least one policy to perform the operation.

DROP POLICY IF EXISTS leads_update ON public.leads;
DROP POLICY IF EXISTS leads_update_admin ON public.leads;
DROP POLICY IF EXISTS leads_convert ON public.leads;

-- Admins: unrestricted UPDATE (convert, dismiss, edit any field)
CREATE POLICY leads_update_admin ON public.leads
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Sales / Ops roles: can UPDATE a lead only if the result has status = 'converted'
-- This blocks dismissing (status='dismissed') for these roles server-side.
CREATE POLICY leads_convert ON public.leads
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'sales_team_lead'::app_role) OR
    public.has_role(auth.uid(), 'sales'::app_role)            OR
    public.has_role(auth.uid(), 'operations_team_lead'::app_role) OR
    public.has_role(auth.uid(), 'operations'::app_role)
  )
  WITH CHECK (status = 'converted');
