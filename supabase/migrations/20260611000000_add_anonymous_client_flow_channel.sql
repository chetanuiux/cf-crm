-- Add 'anonymous_client_flow' channel for anonymous client intake submissions.
-- Must be a standalone migration (Postgres enum values cannot be used in same transaction).

ALTER TYPE public.lead_channel ADD VALUE IF NOT EXISTS 'anonymous_client_flow';
