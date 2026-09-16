-- Landing page (cf-ads) form submissions → public.leads

-- Authenticated users can insert leads (manual entry)
DROP POLICY IF EXISTS leads_insert_auth ON public.leads;
CREATE POLICY leads_insert_auth ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid()));

-- Landing page form (anon key) — website channel only
DROP POLICY IF EXISTS leads_insert_website ON public.leads;
CREATE POLICY leads_insert_website ON public.leads
  FOR INSERT TO anon
  WITH CHECK (channel = 'website'::public.lead_channel AND status = 'new'::public.lead_status);
