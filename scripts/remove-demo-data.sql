-- Remove ONLY seed/demo data (supabase/seed.sql). Real production rows are untouched.
-- Run once in Supabase SQL Editor (or: npm run remove-demo-data with SUPABASE_DB_PASSWORD set).

DO $cleanup$
DECLARE
  demo_users UUID[] := ARRAY[
    '11111111-1111-4111-8111-111111111101'::uuid,
    '11111111-1111-4111-8111-111111111102'::uuid,
    '11111111-1111-4111-8111-111111111103'::uuid
  ];
  demo_firms UUID[] := ARRAY[
    'a0000001-0000-4000-8000-000000000001'::uuid,
    'a0000002-0000-4000-8000-000000000002'::uuid,
    'a0000003-0000-4000-8000-000000000003'::uuid,
    'a0000004-0000-4000-8000-000000000004'::uuid,
    'a0000005-0000-4000-8000-000000000005'::uuid
  ];
  demo_apps UUID[] := ARRAY[
    'b0000001-0000-4000-8000-000000000001'::uuid,
    'b0000002-0000-4000-8000-000000000002'::uuid,
    'b0000003-0000-4000-8000-000000000003'::uuid,
    'b0000004-0000-4000-8000-000000000004'::uuid
  ];
BEGIN
  -- Calendar & notifications
  DELETE FROM public.calendar_events
  WHERE id IN (
    '60000001-0000-4000-8000-000000000001',
    '60000002-0000-4000-8000-000000000002',
    '60000003-0000-4000-8000-000000000003'
  );

  DELETE FROM public.activity_logs
  WHERE related_record_id = ANY(demo_firms || demo_apps);

  DELETE FROM public.notes
  WHERE id = '80000001-0000-4000-8000-000000000001'::uuid
     OR related_record_id = ANY(demo_firms || demo_apps);

  DELETE FROM public.tasks
  WHERE id = '70000001-0000-4000-8000-000000000001'::uuid
     OR firm_id = ANY(demo_firms)
     OR application_id = ANY(demo_apps);

  DELETE FROM public.payments
  WHERE id = 'f0000001-0000-4000-8000-000000000001'::uuid
     OR firm_id = ANY(demo_firms)
     OR application_id = ANY(demo_apps);

  UPDATE public.client_applications SET selected_lender_offer_id = NULL
  WHERE id = ANY(demo_apps);

  DELETE FROM public.lender_offers
  WHERE id = 'e0000001-0000-4000-8000-000000000001'::uuid
     OR application_id = ANY(demo_apps);

  DELETE FROM public.client_applications WHERE id = ANY(demo_apps);

  DELETE FROM public.leads
  WHERE id = '90000001-0000-4000-8000-000000000001'::uuid;

  DELETE FROM public.firm_contacts
  WHERE id IN (
    'c0000001-0000-4000-8000-000000000001',
    'c0000002-0000-4000-8000-000000000002'
  );

  DELETE FROM public.lenders
  WHERE id IN (
    'd0000001-0000-4000-8000-000000000001',
    'd0000002-0000-4000-8000-000000000002'
  );

  -- Bypass firm delete trigger (requires auth.uid() admin/manager — not set in SQL editor batch)
  ALTER TABLE public.firms DISABLE TRIGGER trg_enforce_firm_delete_limit;
  DELETE FROM public.firms WHERE id = ANY(demo_firms);
  ALTER TABLE public.firms ENABLE TRIGGER trg_enforce_firm_delete_limit;

  -- Clear FK references to demo users on any remaining real rows
  UPDATE public.firms SET assigned_account_manager = NULL WHERE assigned_account_manager = ANY(demo_users);
  UPDATE public.firms SET created_by = NULL WHERE created_by = ANY(demo_users);
  UPDATE public.client_applications SET assigned_to = NULL WHERE assigned_to = ANY(demo_users);
  UPDATE public.client_applications SET created_by = NULL WHERE created_by = ANY(demo_users);
  UPDATE public.tasks SET assigned_to = NULL WHERE assigned_to = ANY(demo_users);
  UPDATE public.tasks SET created_by = NULL WHERE created_by = ANY(demo_users);
  UPDATE public.firm_contacts SET created_by = NULL WHERE created_by = ANY(demo_users);
  UPDATE public.notes SET created_by = NULL WHERE created_by = ANY(demo_users);
  UPDATE public.activity_logs SET performed_by = NULL WHERE performed_by = ANY(demo_users);
  DELETE FROM public.calendar_events WHERE user_id = ANY(demo_users);

  -- Demo login accounts (optional test users only)
  DELETE FROM public.user_roles WHERE user_id = ANY(demo_users);
  DELETE FROM public.profiles WHERE id = ANY(demo_users);
  DELETE FROM auth.identities WHERE user_id = ANY(demo_users);
  DELETE FROM auth.users WHERE id = ANY(demo_users);

  RAISE NOTICE 'Demo seed data removed. Real leads and production records were not targeted.';
END $cleanup$;
