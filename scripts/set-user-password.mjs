/**
 * Set Supabase Auth password for a CRM user (direct postgres — dev/admin use).
 * Usage: node --env-file=.env scripts/set-user-password.mjs <email> <password> [role]
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

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

const email = process.argv[2]?.trim().toLowerCase();
const newPassword = process.argv[3];
const role = process.argv[4] ?? 'super_admin';

if (!email || !newPassword) {
  console.error('Usage: node --env-file=.env scripts/set-user-password.mjs <email> <password> [role]');
  process.exit(1);
}

const projectRef =
  process.env.VITE_SUPABASE_PROJECT_ID ||
  (process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname.split('.')[0] : null);
const dbPassword = process.env.SUPABASE_DB_PASSWORD;

if (!projectRef || !dbPassword) {
  console.error('Need VITE_SUPABASE_PROJECT_ID and SUPABASE_DB_PASSWORD in .env');
  process.exit(1);
}

const client = new pg.Client({
  host: `db.${projectRef}.supabase.co`,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  const { rows } = await client.query(
    'SELECT id, email FROM auth.users WHERE lower(email) = lower($1) LIMIT 1',
    [email],
  );

  let userId = rows[0]?.id;

  if (userId) {
    await client.query(
      `UPDATE auth.users
       SET encrypted_password = extensions.crypt($1, extensions.gen_salt('bf')),
           email_confirmed_at = COALESCE(email_confirmed_at, now()),
           updated_at = now()
       WHERE id = $2`,
      [newPassword, userId],
    );
    console.log(`Password updated for ${email}`);
  } else {
    userId = randomUUID();
    const { rows: inst } = await client.query('SELECT id FROM auth.instances LIMIT 1');
    const instanceId = inst[0]?.id ?? '00000000-0000-0000-0000-000000000000';

    await client.query(
      `INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        $1, $2, 'authenticated', 'authenticated', $3,
        extensions.crypt($4, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', $5,
        now(), now(), '', '', '', ''
      )`,
      [instanceId, userId, email, newPassword, JSON.stringify({ full_name: email.split('@')[0] })],
    );

    await client.query(
      `INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
       VALUES ($1, $2, $3, 'email', $4, now(), now(), now())`,
      [
        randomUUID(),
        userId,
        JSON.stringify({ sub: userId, email }),
        userId,
      ],
    );

    console.log(`Created user ${email}`);
  }

  await client.query(
    `INSERT INTO public.profiles (id, full_name, email, active)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, active = true`,
    [userId, email.split('@')[0], email],
  );

  await client.query('DELETE FROM public.user_roles WHERE user_id = $1', [userId]);
  await client.query('INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2::app_role)', [
    userId,
    role,
  ]);

  console.log(`Role set to ${role}`);
  console.log(`User ID: ${userId}`);
  console.log('Login at CRM with this email and password.');
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
