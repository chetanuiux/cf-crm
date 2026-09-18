import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Vercel has no guaranteed Worker cron. While a CRM user is signed in,
 * kick the Supabase processor so due follow-ups still fire during the workday.
 * Overnight processing is handled by pg_cron on Supabase when available.
 */
export function useFollowUpProcessor(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const run = async () => {
      try {
        await supabase.functions.invoke("process-follow-ups", { body: {} });
      } catch {
        // Processor may not be deployed yet; sales triggers still work in Postgres.
      }
    };

    const kick = () => {
      if (!cancelled && typeof document !== "undefined" && document.visibilityState === "visible") {
        void run();
      }
    };

    kick();
    const id = window.setInterval(kick, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);
}
