-- Restrict lead convert/dismiss (UPDATE) to admin roles only.
-- Previously has_any_role allowed any staff member to update leads.
DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));
