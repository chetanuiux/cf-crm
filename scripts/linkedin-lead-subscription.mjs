/**
 * LinkedIn Lead Sync: list or create the lead notification subscription that makes
 * LinkedIn POST new Lead Gen Form leads to the ingest-linkedin-lead Edge Function.
 *
 * Prereqs:
 *   1. Webhook URL added + validated in Developer app → Webhooks (uses the GET challenge).
 *   2. LINKEDIN_ACCESS_TOKEN in .env (scope r_marketing_leadgen_automation) from a user
 *      who has a role on ad account 539500171.
 *
 * Usage:
 *   node --env-file=.env scripts/linkedin-lead-subscription.mjs            # list
 *   node --env-file=.env scripts/linkedin-lead-subscription.mjs --create   # subscribe
 */

const token = process.env.LINKEDIN_ACCESS_TOKEN;
const accountId = process.env.LINKEDIN_AD_ACCOUNT_ID || '539500171';
const apiVersion = process.env.LINKEDIN_API_VERSION || '202608';
const projectRef = process.env.VITE_SUPABASE_PROJECT_ID || 'qagxnrwvueqwjuijbgzg';
const webhookUrl =
  process.env.LINKEDIN_WEBHOOK_URL ||
  `https://${projectRef}.supabase.co/functions/v1/ingest-linkedin-lead`;

if (!token) {
  console.error('Set LINKEDIN_ACCESS_TOKEN in .env first.');
  process.exit(1);
}

const ownerUrn = `urn:li:sponsoredAccount:${accountId}`;
const headers = {
  Authorization: `Bearer ${token}`,
  'Linkedin-Version': apiVersion,
  'X-Restli-Protocol-Version': '2.0.0',
  'Content-Type': 'application/json',
};

async function call(method, path, body) {
  const res = await fetch(`https://api.linkedin.com/rest/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, ok: res.ok, text, id: res.headers.get('x-restli-id') };
}

async function list() {
  const owner = `(sponsoredAccount:${encodeURIComponent(ownerUrn)})`;
  const res = await call(
    'GET',
    `leadNotifications?q=criteria&owner=${owner}&leadType=(leadType:SPONSORED)`,
  );
  console.log(`GET leadNotifications → ${res.status}`);
  console.log(res.text || '(empty)');
  return res;
}

async function create() {
  const res = await call('POST', 'leadNotifications', {
    webhook: webhookUrl,
    owner: { sponsoredAccount: ownerUrn },
    leadType: 'SPONSORED',
  });
  console.log(`POST leadNotifications → ${res.status}${res.id ? ` (id ${res.id})` : ''}`);
  if (res.text) console.log(res.text);
  if (!res.ok) process.exitCode = 1;
}

console.log(`Ad account: ${ownerUrn}\nWebhook:    ${webhookUrl}\nAPI:        ${apiVersion}\n`);
if (process.argv.includes('--create')) {
  await create();
}
await list();
