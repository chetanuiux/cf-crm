import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type TeamRole =
  | 'super_admin'
  | 'admin'
  | 'sales_team_lead'
  | 'sales'
  | 'operations_team_lead'
  | 'operations'
  | 'support';

type ManageUserBody =
  | {
      action: 'create';
      email: string;
      password: string;
      full_name: string;
      role: TeamRole;
      birthday?: string;
    }
  | {
      action: 'update';
      user_id: string;
      email?: string;
      password?: string;
      full_name?: string;
      role?: TeamRole;
      birthday?: string;
    }
  | {
      action: 'delete';
      user_id: string;
    };

async function invokeManageUser(body: ManageUserBody) {
  const { data, error } = await supabase.functions.invoke('admin-manage-user', { body });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error || error.message || 'Failed to manage user');
    }
    throw new Error(error.message || 'Failed to manage user');
  }
  if (data?.error) {
    throw new Error(String(data.error));
  }
  return data;
}

export function createTeamUserViaEdge(input: {
  email: string;
  password: string;
  full_name: string;
  role: TeamRole;
  birthday?: string;
}) {
  return invokeManageUser({ action: 'create', ...input });
}

export function updateTeamUserViaEdge(input: {
  user_id: string;
  email?: string;
  password?: string;
  full_name?: string;
  role?: TeamRole;
  birthday?: string;
}) {
  return invokeManageUser({ action: 'update', ...input });
}

export function deleteTeamUserViaEdge(user_id: string) {
  return invokeManageUser({ action: 'delete', user_id });
}
