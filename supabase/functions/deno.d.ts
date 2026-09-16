/** Minimal Deno types for Supabase Edge Functions (IDE only — runtime provides Deno). */
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
}
