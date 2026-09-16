import { supabase } from '@/integrations/supabase/client';

/** Public live website — sole source for CRM Applications page links and copy. */
export const LIVE_PLATFORM_URL = 'https://www.casefunders.com';

export type PlatformApplication = {
  session_id: string;
  request_id: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  loan_amount: number | null;
  funded_amount: number | null;
  status: string;
  started_by: string | null;
  loan_purpose: string | null;
  firm_name: string | null;
  attorney_email: string | null;
  attorney_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  platform_url: string | null;
};

export function mapPlatformStatus(raw: string, fundedAmount?: number | null): string {
  const s = (raw || '').trim();
  if (s === 'Client Invited') return 'link_sent';
  if (s === 'Application Started') return 'application_started';
  if (s === 'No Offer') return 'no_offers';
  if (s === 'Error') return 'issue_stuck';
  if (s.toLowerCase() === 'funded' || (fundedAmount != null && fundedAmount > 0)) return 'funded';
  if (!s) return 'link_not_sent';
  return 'application_started';
}

export async function listPlatformApplications(): Promise<PlatformApplication[]> {
  const { data, error } = await supabase.functions.invoke('list-platform-applications', {
    body: {},
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to load applications from site');
  }

  if (data?.error) {
    throw new Error(String(data.error));
  }

  return (data?.applications ?? []) as PlatformApplication[];
}

/** Open link — always points at the live CaseFunders website application. */
export function platformApplicationUrl(app: {
  request_id?: string | null;
  platform_url?: string | null;
}): string {
  const base = LIVE_PLATFORM_URL.replace(/\/$/, '');
  if (app.request_id) {
    return `${base}/submit_offer/${app.request_id}/`;
  }
  if (app.platform_url && !app.platform_url.includes('dev.casefunders.com')) {
    return app.platform_url;
  }
  return `${base}/applications/`;
}

export function platformStatusLabel(raw: string): string {
  const s = (raw || '').trim();
  return s || 'None';
}
