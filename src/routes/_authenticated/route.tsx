import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABEL } from "@/lib/labels";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import {
  LayoutDashboard, Building2, Users, FileText,
  StickyNote, BarChart3, Settings, LogOut, Loader2, TrendingUp, Calendar, UserPlus, UserCog, MessageSquare, LifeBuoy, Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { APPLICATIONS_VIEW_ROLES, type AppRole } from "@/lib/auth";
import logoMark from "@/assets/casefunders-mark.jpg";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotificationsRealtime } from "@/hooks/useNotifications";

export const Route = createFileRoute("/_authenticated")({ component: AuthedLayout });

function initials(nameOrEmail: string) {
  const parts = nameOrEmail.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nameOrEmail.slice(0, 2).toUpperCase();
}

// allow undefined = everyone with any role; otherwise restrict to listed roles
const nav: { to: string; label: string; icon: any; allow?: AppRole[] }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: Inbox, allow: ["super_admin", "admin", "sales_team_lead", "sales", "operations_team_lead", "operations"] },
  { to: "/firms", label: "Firms", icon: Building2 },
  // { to: "/calendar", label: "Calendar", icon: Calendar },

  { to: "/applications", label: "Applications", icon: FileText, allow: APPLICATIONS_VIEW_ROLES },

  // { to: "/support-tickets", label: "Support Tickets", icon: LifeBuoy, allow: ["super_admin", "operations_team_lead", "operations"] },
  // { to: "/team-communications", label: "Team Communications", icon: MessageSquare },
  { to: "/notes", label: "Notes", icon: StickyNote },
  // { to: "/signup-lawfirm", label: "Firm Sign Up", icon: UserPlus },
  // { to: "/commissions", label: "Commissions & Tracking", icon: TrendingUp, allow: ["super_admin", "admin", "sales_team_lead", "sales"] },
  // { to: "/reports", label: "Reports", icon: BarChart3, allow: ["super_admin", "admin", "sales_team_lead", "operations_team_lead"] },

  { to: "/settings", label: "Settings", icon: Settings },
];

function AuthedLayout() {
  const { user, loading, profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const qc = useQueryClient();

  // Keep notification badge + dropdown fresh via Realtime
  useNotificationsRealtime();

  const canSeeleads = roles.some(r => ["super_admin", "admin", "sales_team_lead", "sales", "operations_team_lead", "operations"].includes(r));
  const { data: newLeadsCount = 0 } = useQuery({
    queryKey: ["new-leads-count"],
    enabled: !!user && canSeeleads,
    queryFn: async () => {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // Realtime: notify every signed-in user when a new lead arrives
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("leads-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leads" },
        (payload) => {
          const lead = payload.new as { name?: string | null; channel?: string | null };
          const who = lead.name || "Unknown contact";
          const via = lead.channel ? ` via ${lead.channel}` : "";
          toast.info(`New lead: ${who}${via}`, {
            description: "Head to Leads to follow up.",
            action: {
              label: "View",
              onClick: () => navigate({ to: "/leads", search: { page: 1, limit: DEFAULT_PAGE_SIZE, channel: "all", status: "new", q: "" } }),
            },
          });
          qc.invalidateQueries({ queryKey: ["new-leads-count"] });
          qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, navigate, qc]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-64 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <Link to="/dashboard" className="px-4 py-4 border-b border-sidebar-border flex items-center gap-2.5 hover:bg-sidebar-accent/40 transition-colors">
          <img src={logoMark} alt="CaseFunders" className="h-9 w-9 rounded-md object-contain bg-white p-0.5" />
          <div>
            <div className="font-semibold text-sm leading-tight">CaseFunders</div>
            <div className="text-[11px] text-muted-foreground leading-tight">Admin Console</div>
          </div>
        </Link>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {nav.filter(item => !item.allow || item.allow.some(r => roles.includes(r))).map(item => {
            const Icon = item.icon;
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const showBadge = item.to === "/leads" && newLeadsCount > 0;
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {showBadge && (
                  <span className={cn(
                    "ml-auto text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight",
                    active ? "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground" : "bg-primary text-primary-foreground"
                  )}>
                    {newLeadsCount > 99 ? "99+" : newLeadsCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 shrink-0 rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-xs font-semibold">
              {initials(profile?.full_name || profile?.email || "?")}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-sidebar-foreground truncate">{profile?.full_name || profile?.email}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {roles.length ? roles.map(r => ROLE_LABEL[r] ?? r).join(", ") : "No role assigned"}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => signOut().then(() => navigate({ to: "/login" }))}
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="shrink-0 h-11 border-b bg-background flex items-center justify-end px-6">
          <NotificationBell />
        </header>
        <div className="flex-1 overflow-x-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
