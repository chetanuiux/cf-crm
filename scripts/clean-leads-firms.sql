-- Remove ALL leads and firms from CRM (and related child rows).
-- Does NOT delete users, lenders, or platform applications (live website).

BEGIN;

-- Leads
DELETE FROM public.leads;

-- Orphan logs / notes tied to firms, apps, contacts
DELETE FROM public.activity_logs
WHERE related_record_type IN ('firm', 'application', 'contact', 'lead');

DELETE FROM public.notes
WHERE related_record_type IN ('firm', 'application', 'contact');

-- Calendar events linked to a firm
DELETE FROM public.calendar_events WHERE firm_id IS NOT NULL;

-- Firms (cascades: firm_contacts, client_applications, lender_offers, payments, tasks)
ALTER TABLE public.firms DISABLE TRIGGER trg_enforce_firm_delete_limit;
DELETE FROM public.firms;
ALTER TABLE public.firms ENABLE TRIGGER trg_enforce_firm_delete_limit;

COMMIT;
