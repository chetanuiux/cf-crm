-- Optional lead fields already rendered in the CRM Leads table.
-- LinkedIn Ads leads leave client_name null (attorney-direct, no client).

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS funding_amount TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_channel_external_id
  ON public.leads (channel, external_id)
  WHERE external_id IS NOT NULL;
