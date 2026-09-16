
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_channel' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.lead_channel AS ENUM ('callrail', 'calendly', 'manual');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.lead_status AS ENUM ('new', 'converted', 'dismissed');
  END IF;
END $$;

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel public.lead_channel NOT NULL,
  status public.lead_status NOT NULL DEFAULT 'new',
  name text,
  email text,
  phone text,
  company text,
  message text,
  scheduled_at timestamptz,
  external_id text,
  raw_payload jsonb,
  converted_firm_id uuid,
  converted_by uuid,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_status_created ON public.leads (status, created_at DESC);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated USING (true);
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid()));
CREATE POLICY leads_delete ON public.leads FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER leads_set_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
