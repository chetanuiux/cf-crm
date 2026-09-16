/**
 * Delete all CRM leads and firms (and related child data).
 * Usage: npm run clean-leads-firms
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

function loadEnvFile(filename) {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', filename);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile('.env.development');
loadEnvFile('.env');

const projectRef =
  process.env.VITE_SUPABASE_PROJECT_ID ||
  (process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split('.')[0] : null);
const password = process.env.SUPABASE_DB_PASSWORD;

if (!projectRef || !password) {
  console.error('Need VITE_SUPABASE_PROJECT_ID and SUPABASE_DB_PASSWORD in .env');
  process.exit(1);
}

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), 'clean-leads-firms.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Cleaning leads & firms on ${projectRef}…\n`);

  const before = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM public.leads) AS leads,
      (SELECT COUNT(*)::int FROM public.firms) AS firms,
      (SELECT COUNT(*)::int FROM public.firm_contacts) AS contacts,
      (SELECT COUNT(*)::int FROM public.client_applications) AS crm_apps
  `);
  console.log('Before:', before.rows[0]);

  await client.query(sql);

  const after = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM public.leads) AS leads,
      (SELECT COUNT(*)::int FROM public.firms) AS firms,
      (SELECT COUNT(*)::int FROM public.firm_contacts) AS contacts,
      (SELECT COUNT(*)::int FROM public.client_applications) AS crm_apps
  `);
  console.log('After:', after.rows[0]);
  console.log('\nDone. Users, lenders, and live website applications were not removed.');
} catch (err) {
  console.error('Cleanup failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
