-- Allow all CRM staff roles to convert and dismiss leads (UPDATE).
DROP POLICY IF EXISTS leads_update ON public.leads;
DROP POLICY IF EXISTS leads_update_admin ON public.leads;
DROP POLICY IF EXISTS leads_convert ON public.leads;

CREATE POLICY leads_update ON public.leads
  FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid()));
