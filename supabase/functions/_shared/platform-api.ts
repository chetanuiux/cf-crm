/** Live production website — CRM must not read or link to dev.casefunders.com. */
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

export function resolveLivePlatformApiUrl(): string {
  const configured = Deno.env.get('CASEFUNDERS_PLATFORM_API_URL')?.replace(/\/$/, '');
  if (!configured || configured.includes('dev.casefunders.com')) {
    return LIVE_PLATFORM_URL;
  }
  return configured;
}

function normalizeApplication(app: PlatformApplication): PlatformApplication {
  const base = LIVE_PLATFORM_URL;
  const platform_url = app.request_id
    ? `${base}/submit_offer/${app.request_id}/`
    : `${base}/applications/`;
  return { ...app, platform_url };
}

export async function fetchPlatformApplications(params: {
  platformApiUrl: string;
  apiToken: string;
  sessionId?: string;
  since?: string;
}): Promise<PlatformApplication[]> {
  const base = params.platformApiUrl.replace(/\/$/, '');
  const all: PlatformApplication[] = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const q = new URLSearchParams({
      page: String(page),
      per_page: '200',
    });
    if (params.sessionId) q.set('session_id', params.sessionId);
    if (params.since) q.set('since', params.since);

    const res = await fetch(`${base}/api/crm/applications/?${q.toString()}`, {
      headers: { 'X-CRM-API-Token': params.apiToken },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform API ${res.status}: ${text.slice(0, 200)}`);
    }

    const payload = (await res.json()) as {
      applications: PlatformApplication[];
      pagination?: { has_next?: boolean };
    };

    all.push(...(payload.applications ?? []).map(normalizeApplication));
    hasNext = Boolean(payload.pagination?.has_next) && !params.sessionId;
    page += 1;
    if (params.sessionId) break;
  }

  return all;
}
