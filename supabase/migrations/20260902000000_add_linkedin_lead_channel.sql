-- Add 'linkedin' channel for LinkedIn Ads Lead Gen Form submissions.
-- Must be a standalone migration (Postgres enum values cannot be used in same transaction).

ALTER TYPE public.lead_channel ADD VALUE IF NOT EXISTS 'linkedin';
