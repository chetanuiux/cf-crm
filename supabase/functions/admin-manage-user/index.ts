import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders, jsonResponse } from '../_shared/cors.ts';

const ALL_ROLES = [
  'super_admin',
  'admin',
  'sales_team_lead',
  'sales',
  'operations_team_lead',
  'operations',
  'support',
] as const;

type AppRole = (typeof ALL_ROLES)[number];

type Body = {
  action: 'create' | 'update' | 'delete';
  email?: string;
  password?: string;
  full_name?: string;
  role?: AppRole;
  birthday?: string;
  user_id?: string;
};

async function requireAdmin(authHeader: string | null) {
  if (!authHeader) throw new Error('Missing authorization');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser();
  if (userErr || !user) throw new Error('Unauthorized');

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: roles, error: roleErr } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (roleErr) throw new Error(roleErr.message);

  const isAdmin = (roles ?? []).some(
    (r: { role: string }) => r.role === 'admin' || r.role === 'super_admin',
  );
  if (!isAdmin) throw new Error('Only admins can manage users');

  return { callerId: user.id, admin };
}

function assertRole(role: string | undefined): AppRole {
  if (!role || !ALL_ROLES.includes(role as AppRole)) {
    throw new Error(`Invalid role: ${role ?? '(empty)'}`);
  }
  return role as AppRole;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = (await req.json()) as Body;
    const { callerId, admin } = await requireAdmin(req.headers.get('Authorization'));

    if (body.action === 'create') {
      const email = body.email?.trim().toLowerCase();
      const password = body.password ?? '';
      const full_name = body.full_name?.trim() ?? '';
      const role = assertRole(body.role);

      if (!email || password.length < 8) {
        return jsonResponse({ error: 'Email and password (min 8 chars) are required' }, 400);
      }
      if (!full_name) {
        return jsonResponse({ error: 'Full name is required' }, 400);
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr) {
        return jsonResponse({ error: createErr.message }, 400);
      }

      const newId = created.user?.id;
      if (!newId) {
        return jsonResponse({ error: 'User creation returned no id' }, 500);
      }

      await admin.from('user_roles').delete().eq('user_id', newId);
      const { error: insErr } = await admin.from('user_roles').insert({ user_id: newId, role });
      if (insErr) {
        return jsonResponse({ error: insErr.message }, 500);
      }

      if (body.birthday) {
        await admin.from('profiles').update({ birthday: body.birthday }).eq('id', newId);
      }

      return jsonResponse({ id: newId, email });
    }

    if (body.action === 'update') {
      const userId = body.user_id?.trim();
      if (!userId) return jsonResponse({ error: 'user_id is required' }, 400);

      if (body.full_name?.trim() || body.birthday) {
        const profileUpdate: Record<string, string> = {};
        if (body.full_name?.trim()) profileUpdate.full_name = body.full_name.trim();
        if (body.birthday) profileUpdate.birthday = body.birthday;
        const { error: profileErr } = await admin.from('profiles').update(profileUpdate).eq('id', userId);
        if (profileErr) return jsonResponse({ error: profileErr.message }, 400);
      }

      const authUpdates: {
        email?: string;
        password?: string;
        user_metadata?: Record<string, string>;
      } = {};
      if (body.email?.trim()) authUpdates.email = body.email.trim().toLowerCase();
      if (body.password && body.password.length >= 8) authUpdates.password = body.password;
      if (body.full_name?.trim()) authUpdates.user_metadata = { full_name: body.full_name.trim() };

      if (Object.keys(authUpdates).length) {
        const { error: authErr } = await admin.auth.admin.updateUserById(userId, authUpdates);
        if (authErr) return jsonResponse({ error: authErr.message }, 400);
      }

      if (body.role) {
        const role = assertRole(body.role);
        await admin.from('user_roles').delete().eq('user_id', userId);
        const { error: roleErr } = await admin.from('user_roles').insert({ user_id: userId, role });
        if (roleErr) return jsonResponse({ error: roleErr.message }, 400);
      }

      return jsonResponse({ ok: true });
    }

    if (body.action === 'delete') {
      const userId = body.user_id?.trim();
      if (!userId) return jsonResponse({ error: 'user_id is required' }, 400);
      if (userId === callerId) {
        return jsonResponse({ error: 'You cannot delete your own account' }, 400);
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(userId);
      if (delErr) return jsonResponse({ error: delErr.message }, 400);

      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Request failed';
    const status =
      message === 'Unauthorized' || message === 'Missing authorization' ? 401 : 400;
    return jsonResponse({ error: message }, status);
  }
});
