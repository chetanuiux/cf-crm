
-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE app_role AS ENUM ('super_admin','admin','sales','operations','support');

CREATE TYPE firm_sales_status AS ENUM (
  'new_lead','contacted','interested','demo_booked','demo_completed','demo_no_show',
  'demo_needs_reschedule','follow_up_after_demo','signup_link_sent','signed_up',
  'lost_not_interested','reconnect_later');

CREATE TYPE firm_onboarding_status AS ENUM (
  'not_started','signup_submitted','firm_profile_incomplete','users_pending',
  'payment_setup_pending','training_pending','ready_for_first_application','complete');

CREATE TYPE firm_payment_status AS ENUM (
  'not_started','onboarding_link_sent','started','bank_account_needed',
  'bank_account_connected','verification_pending','verified_ready','issue_manual_review','disabled');

CREATE TYPE lead_source AS ENUM (
  'cold_call','email_campaign','google_ads','referral','event','linkedin',
  'website','partner','manual_entry','other');

CREATE TYPE application_status AS ENUM (
  'link_not_sent','link_sent','application_started','submitted','offers_available',
  'no_offers','client_selected_offer','approved','declined','funded','paid_to_firm',
  'issue_stuck','cancelled');

CREATE TYPE lender_result_status AS ENUM (
  'not_sent','pending','offers_returned','no_offers','manual_review','error');

CREATE TYPE funding_status AS ENUM (
  'not_started','pending','approved','disbursed_to_client','confirmed_funded',
  'failed','cancelled','manual_review');

CREATE TYPE payment_to_firm_status AS ENUM (
  'not_started','payment_method_needed','payment_method_saved','ready_to_charge',
  'charged','paid_to_firm','failed','refunded','manual_review','cancelled');

CREATE TYPE task_status AS ENUM ('open','in_progress','completed','overdue','cancelled');
CREATE TYPE task_priority AS ENUM ('low','medium','high','urgent');
CREATE TYPE task_type AS ENUM ('follow_up','demo','onboarding','application_issue','payment_funding_issue','support','sales','internal');

CREATE TYPE note_type AS ENUM ('general','call_log','email','meeting','follow_up','support','payment_funding');

CREATE TYPE lender_status AS ENUM ('active','inactive','testing','paused','reconnect_later');
CREATE TYPE lender_offer_status AS ENUM ('pending','offered','declined','selected','expired','error','manual_review');

CREATE TYPE firm_contact_role AS ENUM ('firm_admin','attorney','billing_staff','staff_assistant','other');
CREATE TYPE payment_processor AS ENUM ('confido','stripe','manual','other','not_set');
CREATE TYPE destination_type AS ENUM ('trust_account','operating_account','unknown_not_set');
CREATE TYPE yes_no_unknown AS ENUM ('yes','no','not_required','unknown');

-- =============================================
-- PROFILES & ROLES
-- =============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin'))
$$;

-- Auto-create profile and assign first user as super_admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'support');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- CORE TABLES
-- =============================================
CREATE TABLE lenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status lender_status NOT NULL DEFAULT 'active',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  avg_approval_rate NUMERIC,
  avg_decision_time_hours NUMERIC,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  main_contact_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  practice_areas TEXT[],
  state TEXT,
  firm_size TEXT,
  lead_source lead_source DEFAULT 'manual_entry',
  sales_status firm_sales_status NOT NULL DEFAULT 'new_lead',
  onboarding_status firm_onboarding_status NOT NULL DEFAULT 'not_started',
  payment_status firm_payment_status NOT NULL DEFAULT 'not_started',
  assigned_account_manager UUID REFERENCES profiles(id),
  last_activity_date TIMESTAMPTZ DEFAULT now(),
  next_follow_up_date DATE,
  lost_reason TEXT,
  reconnect_date DATE,
  reconnect_notes TEXT,
  payment_processor payment_processor NOT NULL DEFAULT 'not_set',
  trust_account_connected yes_no_unknown NOT NULL DEFAULT 'unknown',
  operating_account_connected yes_no_unknown NOT NULL DEFAULT 'unknown',
  payment_setup_notes TEXT,
  payment_setup_updated_at TIMESTAMPTZ,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_firms_sales_status ON firms(sales_status);
CREATE INDEX idx_firms_onboarding_status ON firms(onboarding_status);
CREATE INDEX idx_firms_payment_status ON firms(payment_status);

CREATE TABLE firm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role firm_contact_role NOT NULL DEFAULT 'other',
  permission_level TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_contacted_date TIMESTAMPTZ,
  perm_view_dashboard BOOLEAN NOT NULL DEFAULT false,
  perm_send_app_links BOOLEAN NOT NULL DEFAULT false,
  perm_view_applications BOOLEAN NOT NULL DEFAULT false,
  perm_view_payment_status BOOLEAN NOT NULL DEFAULT false,
  perm_view_transactions BOOLEAN NOT NULL DEFAULT false,
  perm_process_payments BOOLEAN NOT NULL DEFAULT false,
  perm_issue_refunds BOOLEAN NOT NULL DEFAULT false,
  perm_manage_firm_users BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_firm_contacts_firm ON firm_contacts(firm_id);

CREATE TABLE client_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  firm_contact_id UUID REFERENCES firm_contacts(id) ON DELETE SET NULL,
  application_source TEXT,
  link_sent_date TIMESTAMPTZ,
  started_date TIMESTAMPTZ,
  submitted_date TIMESTAMPTZ,
  amount_requested NUMERIC,
  case_type TEXT,
  status application_status NOT NULL DEFAULT 'link_not_sent',
  lender_result_status lender_result_status NOT NULL DEFAULT 'not_sent',
  selected_lender_offer_id UUID,
  funding_status funding_status NOT NULL DEFAULT 'not_started',
  payment_to_firm_status payment_to_firm_status NOT NULL DEFAULT 'not_started',
  stuck BOOLEAN NOT NULL DEFAULT false,
  stuck_reason TEXT,
  stuck_flagged_date TIMESTAMPTZ,
  stuck_assigned_to UUID REFERENCES profiles(id),
  stuck_resolution_notes TEXT,
  stuck_resolved BOOLEAN NOT NULL DEFAULT false,
  stuck_resolved_date TIMESTAMPTZ,
  assigned_to UUID REFERENCES profiles(id),
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_apps_firm ON client_applications(firm_id);
CREATE INDEX idx_apps_status ON client_applications(status);

CREATE TABLE lender_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES client_applications(id) ON DELETE CASCADE,
  lender_id UUID REFERENCES lenders(id),
  offer_amount NUMERIC,
  apr NUMERIC,
  term_months INT,
  estimated_monthly_payment NUMERIC,
  estimated_funding_timeline TEXT,
  status lender_offer_status NOT NULL DEFAULT 'pending',
  selected_by_client BOOLEAN NOT NULL DEFAULT false,
  offer_expiration_date DATE,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_offers_app ON lender_offers(application_id);

ALTER TABLE client_applications
  ADD CONSTRAINT fk_selected_offer FOREIGN KEY (selected_lender_offer_id)
  REFERENCES lender_offers(id) ON DELETE SET NULL;

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  application_id UUID REFERENCES client_applications(id) ON DELETE SET NULL,
  funded_amount NUMERIC,
  amount_expected_to_firm NUMERIC,
  casefunders_fee_amount NUMERIC,
  target_funding_date DATE,
  actual_funding_date DATE,
  payment_processor payment_processor NOT NULL DEFAULT 'not_set',
  external_transaction_id TEXT,
  funds_released_to_firm BOOLEAN NOT NULL DEFAULT false,
  status payment_to_firm_status NOT NULL DEFAULT 'not_started',
  destination_type destination_type NOT NULL DEFAULT 'unknown_not_set',
  manual_review BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_firm ON payments(firm_id);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  firm_id UUID REFERENCES firms(id) ON DELETE CASCADE,
  application_id UUID REFERENCES client_applications(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES firm_contacts(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  lender_id UUID REFERENCES lenders(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id),
  due_date DATE,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'open',
  task_type task_type NOT NULL DEFAULT 'follow_up',
  created_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);

CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  related_record_type TEXT NOT NULL,
  related_record_id UUID NOT NULL,
  note_type note_type NOT NULL DEFAULT 'general',
  note_body TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_by_role app_role,
  edited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_related ON notes(related_record_type, related_record_id);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  related_record_type TEXT NOT NULL,
  related_record_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  performed_by_role app_role,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_related ON activity_logs(related_record_type, related_record_id);
CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','lenders','firms','firm_contacts','client_applications','lender_offers','payments','tasks','notes']) LOOP
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- =============================================
-- RLS
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE lender_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: authenticated can read all; users update own; admins update any
CREATE POLICY "profiles_select_auth" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_self" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "profiles_insert_self" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- user_roles
CREATE POLICY "roles_select_auth" ON user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "roles_admin_all" ON user_roles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Generic policy helper: authenticated read all, authenticated insert/update, admin delete
-- Apply to firms, contacts, apps, offers, lenders, tasks, notes, activity_logs
-- Payments: support role cannot change status (handled at UI), but RLS allows updates by non-support
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['lenders','firms','firm_contacts','client_applications','lender_offers','tasks']) LOOP
    EXECUTE format('CREATE POLICY "%s_select" ON %s FOR SELECT TO authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON %s FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON %s FOR UPDATE TO authenticated USING (public.has_any_role(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON %s FOR DELETE TO authenticated USING (public.is_admin(auth.uid()))', t, t);
  END LOOP;
END $$;

-- Payments: admin/ops only for write
CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_write" ON payments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'operations'));
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'operations'));
CREATE POLICY "payments_delete" ON payments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Notes: anyone authenticated can read/insert; only author or admin can update/delete
CREATE POLICY "notes_select" ON notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "notes_insert" ON notes FOR INSERT TO authenticated WITH CHECK (public.has_any_role(auth.uid()));
CREATE POLICY "notes_update" ON notes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "notes_delete" ON notes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()));

-- Activity logs: read auth, insert auth, no update/delete
CREATE POLICY "activity_select" ON activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_insert" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);
