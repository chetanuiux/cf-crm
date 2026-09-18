/**
 * Apply only the CaseFunders follow-up migrations to the linked Supabase project.
 * Uses .env.development / .env (same as migrate:all).
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
  console.error('Need VITE_SUPABASE_PROJECT_ID and SUPABASE_DB_PASSWORD');
  process.exit(1);
}

const files = [
  '20260917000000_pipeline_enum_values.sql',
  '20260917000001_follow_up_engine.sql',
  '20260917000002_follow_up_cron.sql',
];

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../supabase/migrations');
const poolerHost =
  process.env.SUPABASE_DB_POOLER_HOST ||
  'aws-1-ap-northeast-1.pooler.supabase.com';

const client = new pg.Client({
  host: poolerHost,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  database: 'postgres',
  user: `postgres.${projectRef}`,
  password,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`Connected to ${projectRef}. Applying follow-up migrations…\n`);

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    process.stdout.write(`→ ${file} … `);
    try {
      await client.query(sql);
      console.log('OK');
    } catch (err) {
      const msg = err.message || String(err);
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate key') ||
        msg.includes('already present') ||
        /enum label .* already exists/i.test(msg)
      ) {
        console.log(`SKIP (${msg.split('\n')[0]})`);
        continue;
      }
      console.log('FAILED');
      throw err;
    }
  }

  const { rows } = await client.query(`
    SELECT to_regclass('public.follow_ups') AS follow_ups,
           to_regclass('public.platform_applications') AS platform_applications,
           EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'process_due_follow_ups') AS process_fn
  `);
  console.log('\nVerify:', rows[0]);
  console.log('\nFollow-up migrations finished.');
} catch (err) {
  console.error('\nMigration error:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
