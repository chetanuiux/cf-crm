ALTER TYPE firm_onboarding_status ADD VALUE IF NOT EXISTS 'bank_account_connected';
ALTER TYPE firm_onboarding_status ADD VALUE IF NOT EXISTS 'onboarding_done';
ALTER TYPE firm_onboarding_status ADD VALUE IF NOT EXISTS 'completed_first_application';
ALTER TYPE firm_onboarding_status ADD VALUE IF NOT EXISTS 'funded_three_cases';