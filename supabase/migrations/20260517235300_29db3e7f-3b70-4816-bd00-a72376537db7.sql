
CREATE TABLE public.notification_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_log_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_log_id)
);

CREATE INDEX idx_notif_dismiss_user ON public.notification_dismissals(user_id);

ALTER TABLE public.notification_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY nd_select_own ON public.notification_dismissals
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY nd_insert_own ON public.notification_dismissals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY nd_delete_own ON public.notification_dismissals
  FOR DELETE TO authenticated USING (user_id = auth.uid());
