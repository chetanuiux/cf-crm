-- Preserve the client/case name when a lead is converted to a firm.
ALTER TABLE public.firms
  ADD COLUMN IF NOT EXISTS client_name TEXT;
