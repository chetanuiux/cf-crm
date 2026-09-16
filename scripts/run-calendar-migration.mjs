/**
 * Run calendar migration using credentials from .env.development
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

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const projectRef =
  process.env.VITE_SUPABASE_PROJECT_ID ||
  (supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : null);

const password = process.env.SUPABASE_DB_PASSWORD;

if (!projectRef) {
  console.error('Missing SUPABASE_URL or VITE_SUPABASE_PROJECT_ID in .env.development');
  process.exit(1);
}

if (!password) {
  console.error(
    `Using project: ${projectRef}\n` +
      'Missing SUPABASE_DB_PASSWORD in .env.development.\n' +
      'The anon/publishable key cannot run migrations — add your database password:\n' +
      `  https://supabase.com/dashboard/project/${projectRef}/settings/database\n` +
      'Then add to .env.development:\n' +
      '  SUPABASE_DB_PASSWORD="your-password"\n',
  );
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '../supabase/migrations/20260518120000_calendar_events.sql');
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
  console.log(`Connected to ${projectRef}. Running calendar migration…`);
  await client.query(sql);
  console.log('Migration applied successfully.');
} catch (err) {
  console.error('Migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
