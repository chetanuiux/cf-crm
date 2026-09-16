-- Add team lead roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales_team_lead';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operations_team_lead';