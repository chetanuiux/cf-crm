import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "sales_team_lead" | "sales" | "operations_team_lead" | "operations" | "support";

/** Roles allowed to open /applications */
export const APPLICATIONS_VIEW_ROLES: AppRole[] = ["super_admin", "admin", "operations"];

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: { id: string; full_name: string | null; email: string | null } | null;
  roles: AppRole[];
  loading: boolean;
  signOut: () => Promise<void>;
  hasRole: (r: AppRole | AppRole[]) => boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canViewApplications: boolean;
  canManageUsers: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canEditPayments: boolean;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthState["profile"]>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
        setRoles([]);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (uid: string) => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile(p ?? null);
    setRoles((r ?? []).map(x => x.role as AppRole));
  };

  const hasRole = (r: AppRole | AppRole[]) => {
    const arr = Array.isArray(r) ? r : [r];
    return arr.some(role => roles.includes(role));
  };
  const isAdmin = hasRole(["super_admin", "admin"]);
  const isSuperAdmin = hasRole("super_admin");
  const canViewApplications = hasRole(APPLICATIONS_VIEW_ROLES);
  const canManageUsers = isAdmin;
  const canWrite = roles.length > 0;
  const canDelete = isAdmin;
  const canEditPayments = isAdmin || hasRole("operations");

  const value: AuthState = {
    user, session, profile, roles, loading,
    signOut: async () => { await supabase.auth.signOut(); },
    hasRole, isAdmin, isSuperAdmin, canViewApplications, canManageUsers, canWrite, canDelete, canEditPayments,
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
