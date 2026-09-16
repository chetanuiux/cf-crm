-- Notifications table: per-user inbox for CRM events.
-- Currently only new-lead events are generated (via trigger below).

CREATE TABLE public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL DEFAULT 'new_lead',
  title      TEXT        NOT NULL,
  message    TEXT        NOT NULL DEFAULT '',
  lead_id    UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  read       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

-- Partial index keeps unread-count queries fast
CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id)
  WHERE read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Each user sees only their own rows
CREATE POLICY "notifs_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users may mark their own notifications read (or delete them)
CREATE POLICY "notifs_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifs_delete_own" ON public.notifications
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── Trigger: fan-out a notification to every lead-visible user on INSERT ──────

CREATE OR REPLACE FUNCTION public.notify_new_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r   RECORD;
  msg TEXT;
BEGIN
  msg := CASE
    WHEN NEW.company IS NOT NULL AND trim(NEW.company) <> ''
      THEN 'From ' || trim(NEW.company)
           || COALESCE(' via ' || NEW.channel::text, '')
    ELSE
      COALESCE('Via ' || NEW.channel::text, 'New lead submitted')
  END;

  -- Insert one notification per user who can see leads
  -- (super_admin, admin, sales_team_lead, sales)
  FOR r IN
    SELECT DISTINCT user_id
    FROM   public.user_roles
    WHERE  role IN (
      'super_admin'::app_role,
      'admin'::app_role,
      'sales_team_lead'::app_role,
      'sales'::app_role
    )
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, lead_id)
    VALUES (
      r.user_id,
      'new_lead',
      'New lead: ' || COALESCE(trim(NEW.name), 'Unknown contact'),
      msg,
      NEW.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_lead();

-- Expose notifications to Supabase Realtime so the frontend can subscribe
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
