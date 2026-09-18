-- New ledger values for CaseFunders sales, onboarding, and application substatus.
-- These must land in their own migration so later statements can use the new labels.

ALTER TYPE public.firm_onboarding_status ADD VALUE IF NOT EXISTS 'onboarding_submitted';
ALTER TYPE public.firm_onboarding_status ADD VALUE IF NOT EXISTS 'onboarding_approved';
ALTER TYPE public.firm_onboarding_status ADD VALUE IF NOT EXISTS 'first_case_funded';
ALTER TYPE public.firm_onboarding_status ADD VALUE IF NOT EXISTS 'three_cases_funded';

ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'application_invite_sent';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'application_incomplete';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'no_offers_available';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'offer_selection_needed';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'client_declined_offers';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'offer_processing';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'funds_in_transit';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'error';
ALTER TYPE public.application_status ADD VALUE IF NOT EXISTS 'application_withdrawn';
