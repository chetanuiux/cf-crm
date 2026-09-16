/** Fixed IDs and patterns from supabase/seed.sql — used to hide/remove demo rows only. */

export const DEMO_USER_IDS = [
  "11111111-1111-4111-8111-111111111101",
  "11111111-1111-4111-8111-111111111102",
  "11111111-1111-4111-8111-111111111103",
] as const;

export const DEMO_FIRM_IDS = [
  "a0000001-0000-4000-8000-000000000001",
  "a0000002-0000-4000-8000-000000000002",
  "a0000003-0000-4000-8000-000000000003",
  "a0000004-0000-4000-8000-000000000004",
  "a0000005-0000-4000-8000-000000000005",
] as const;

export const DEMO_SEED_IDS = new Set<string>([
  ...DEMO_USER_IDS,
  ...DEMO_FIRM_IDS,
  "c0000001-0000-4000-8000-000000000001",
  "c0000002-0000-4000-8000-000000000002",
  "d0000001-0000-4000-8000-000000000001",
  "d0000002-0000-4000-8000-000000000002",
  "b0000001-0000-4000-8000-000000000001",
  "b0000002-0000-4000-8000-000000000002",
  "b0000003-0000-4000-8000-000000000003",
  "b0000004-0000-4000-8000-000000000004",
  "e0000001-0000-4000-8000-000000000001",
  "f0000001-0000-4000-8000-000000000001",
  "70000001-0000-4000-8000-000000000001",
  "80000001-0000-4000-8000-000000000001",
  "90000001-0000-4000-8000-000000000001",
  "60000001-0000-4000-8000-000000000001",
  "60000002-0000-4000-8000-000000000002",
  "60000003-0000-4000-8000-000000000003",
]);

type DemoCheckable = {
  id?: string | null;
  email?: string | null;
  client_email?: string | null;
  contact_email?: string | null;
  firm_id?: string | null;
  application_id?: string | null;
  related_record_id?: string | null;
  meeting_url?: string | null;
};

export function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e.endsWith(".demo") || e.endsWith("@casefunders.demo");
}

export function isDemoSeedId(id: string | null | undefined): boolean {
  return !!id && DEMO_SEED_IDS.has(id);
}

export function isDemoFirmId(id: string | null | undefined): boolean {
  return !!id && (DEMO_FIRM_IDS as readonly string[]).includes(id);
}

export function isDemoRecord(record: DemoCheckable): boolean {
  if (isDemoSeedId(record.id)) return true;
  if (isDemoFirmId(record.firm_id)) return true;
  if (isDemoSeedId(record.application_id)) return true;
  if (isDemoSeedId(record.related_record_id)) return true;
  if (isDemoEmail(record.email)) return true;
  if (isDemoEmail(record.client_email)) return true;
  if (isDemoEmail(record.contact_email)) return true;
  if (record.meeting_url?.includes("/demo-")) return true;
  return false;
}

export function isDemoUser(profile: { id?: string | null; email?: string | null }): boolean {
  if (profile.id && (DEMO_USER_IDS as readonly string[]).includes(profile.id)) return true;
  return isDemoEmail(profile.email);
}

export function excludeDemoRecords<T extends DemoCheckable>(rows: T[] | null | undefined): T[] {
  return (rows ?? []).filter((row) => !isDemoRecord(row));
}

export function excludeDemoUsers<T extends { id?: string | null; email?: string | null }>(
  rows: T[] | null | undefined,
): T[] {
  return (rows ?? []).filter((row) => !isDemoUser(row));
}

/** PostgREST filters for paginated lead lists (excludes seed/demo rows server-side). */
export function applyDemoLeadFilters<Q extends { not: (col: string, op: string, val: string) => Q }>(query: Q): Q {
  const idList = [...DEMO_SEED_IDS]
    .filter((id) => id.startsWith("90000001"))
    .map((id) => `"${id}"`)
    .join(",");
  if (idList) query = query.not("id", "in", `(${idList})`);
  // NULL emails must pass through — NOT ILIKE returns NULL (falsy) for NULLs in Postgres
  return (query as any).or("email.is.null,email.not.ilike.%.demo");
}

/** PostgREST filters for paginated firm lists (excludes seed/demo rows server-side). */
export function applyDemoFirmFilters<Q extends { not: (col: string, op: string, val: string) => Q }>(query: Q): Q {
  const idList = DEMO_FIRM_IDS.map((id) => `"${id}"`).join(",");
  if (idList) query = query.not("id", "in", `(${idList})`);
  // NULL emails must pass through — NOT ILIKE returns NULL (falsy) for NULLs in Postgres
  return (query as any).or("email.is.null,email.not.ilike.%.demo");
}
