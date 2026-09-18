-- Background processing so follow-ups keep running on Vercel (UI) + Supabase (data).
-- Sales due-dates fire from SQL. Application sync hits the process-follow-ups Edge Function.

CREATE TABLE IF NOT EXISTS public.follow_up_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
ALTER TABLE public.follow_up_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.follow_up_settings (key, value)
VALUES ('cron_secret', gen_random_uuid()::text)
ON CONFLICT (key) DO NOTHING;

DO $ext$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron unavailable: %', SQLERRM;
END
$ext$;

DO $ext$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net unavailable: %', SQLERRM;
END
$ext$;

DO $cron$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'Skipping follow-up cron; enable pg_cron in the Supabase dashboard if you need overnight processing.';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    PERFORM cron.unschedule(j.jobid)
      FROM cron.job j
     WHERE j.jobname IN ('process-due-follow-ups', 'invoke-process-follow-ups');
  END IF;

  PERFORM cron.schedule(
    'process-due-follow-ups',
    '*/15 * * * *',
    $job$SELECT public.process_due_follow_ups(500)$job$
  );

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM cron.schedule(
      'invoke-process-follow-ups',
      '*/15 * * * *',
      $job$
      SELECT net.http_post(
        url := 'https://qagxnrwvueqwjuijbgzg.supabase.co/functions/v1/process-follow-ups?secret=' ||
               (SELECT value FROM public.follow_up_settings WHERE key = 'cron_secret'),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $job$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'follow-up cron not scheduled: %', SQLERRM;
END
$cron$;
