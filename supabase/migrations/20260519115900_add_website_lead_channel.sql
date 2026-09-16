-- Add 'website' channel for marketing site submissions.
-- Must be a standalone migration (Postgres enum values cannot be used in same transaction).

ALTER TYPE public.lead_channel ADD VALUE IF NOT EXISTS 'website';

