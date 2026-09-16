/**
 * Apply LinkedIn Ads lead migrations using .env.development / .env
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'supabase/migrations/20260902000000_add_linkedin_lead_channel.sql',
  'supabase/migrations/20260902000001_leads_linkedin_fields.sql',
];

const targets = [
  {
    label: 'pooler aws-1-ap-northeast-1 session',
    host: 'aws-1-ap-northeast-1.pooler.supabase.com',
    port: 5432,
    user: `postgres.${projectRef}`,
    ssl: { rejectUnauthorized: false },
  },
];

async function connect() {
  let lastErr;
  for (const t of targets) {
    const client = new pg.Client({
      host: t.host,
      port: t.port,
      database: 'postgres',
      user: t.user,
      password,
      ssl: t.ssl,
      connectionTimeoutMillis: 12000,
    });
    try {
      await client.connect();
      console.log(`Connected via ${t.label}`);
      return client;
    } catch (err) {
      lastErr = err;
      console.log(`Failed ${t.label}: ${err.message}`);
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr;
}

const client = await connect();

try {
  console.log(`Project ${projectRef}`);

  for (const file of files) {
    process.stdout.write(`→ ${file} … `);
    try {
      await client.query(readFileSync(join(root, file), 'utf8'));
      console.log('OK');
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('already exists') || msg.includes('duplicate key')) {
        console.log(`SKIP (${msg.split('\n')[0]})`);
        continue;
      }
      console.log('FAILED');
      throw err;
    }
  }

  const enums = await client.query(
    `select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid
     where t.typname='lead_channel' order by e.enumsortorder`,
  );
  console.log('lead_channel:', enums.rows.map((r) => r.enumlabel).join(', '));

  const cols = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='leads'
       and column_name in ('client_name','city','state','funding_amount')
     order by column_name`,
  );
  console.log('extra lead columns:', cols.rows.map((r) => r.column_name).join(', ') || '(none)');
  console.log('\nLinkedIn migrations finished.');
} catch (err) {
  console.error('\nMigration error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
