import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fmtDate, titleize, ROLE_LABEL } from "@/lib/labels";
import { StatusBadge } from "@/components/StatusBadge";
import { priorityTone, taskTone } from "@/lib/labels";
import { useAuth, type AppRole } from "@/lib/auth";
import { toast } from "sonner";
import {
  Plus,
  Calendar as CalendarIcon,
  Undo2,
} from "lucide-react";
import { FirmDeletedNotifications } from "@/components/FirmDeletedNotifications";
import { getDailyPhrase } from "@/lib/daily-phrases";
import { excludeDemoRecords } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Metric({
  label,
  value,
  to,
  hint,
  overdueCount,
}: {
  label: string;
  value: string | number;
  to?: string;
  hint?: string;
  overdueCount?: number;
}) {
  const hasOverdue = typeof overdueCount === "number";
  const overdueClass =
    hasOverdue && overdueCount! > 0 ? "text-destructive font-medium" : "text-muted-foreground";
  const inner = (
    <Card className="hover:border-primary/40 transition-colors h-full">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {hasOverdue ? (
          <div className={`text-xs mt-0.5 ${overdueClass}`}>{overdueCount} overdue</div>
        ) : hint ? (
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function Dashboard() {
  const { user, hasRole, isAdmin, profile } = useAuth();
  const qc = useQueryClient();

  const isSalesLead = hasRole("sales_team_lead");
  const isSales = hasRole("sales") || isSalesLead;
  const isOpsLead = hasRole("operations_team_lead");
  const isOps = hasRole("operations") || isOpsLead;

  const APPROVED_STATUSES: ("approved" | "funded" | "paid_to_firm")[] = [
    "approved",
    "funded",
    "paid_to_firm",
  ];

  const { data: m } = useQuery({
    queryKey: ["dashboard-metrics", user?.id, isSalesLead, isOpsLead, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      const uid = user!.id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const in7 = new Date(today);
      in7.setDate(in7.getDate() + 7);
      const days30 = new Date(today);
      days30.setDate(days30.getDate() - 30);
      const months6 = new Date(today);
      months6.setMonth(months6.getMonth() - 6);

      // Personal scope — firms assigned to me as account manager
      const { data: myFirmsRaw } = await supabase
        .from("firms")
        .select("id, sales_status, archived, created_at, assigned_account_manager")
        .eq("assigned_account_manager", uid);
      const myFirms = excludeDemoRecords((myFirmsRaw ?? []).filter((f) => !f.archived));

      const { data: myTasks } = await supabase
        .from("tasks")
        .select("id, status, due_date, assigned_to")
        .or(`assigned_to.eq.${uid},assigned_to.is.null`)
        .neq("status", "completed")
        .neq("status", "cancelled");

      const mySignedUp30 = myFirms.filter(
        (f) => f.sales_status === "signed_up" && new Date(f.created_at) >= days30,
      ).length;
      const myActive = myFirms.filter(
        (f) => f.sales_status === "signed_up" && new Date(f.created_at) >= months6,
      ).length;
      const myOpen = excludeDemoRecords(myTasks ?? []).length;
      const myOverdue = excludeDemoRecords(myTasks ?? []).filter(
        (t) => t.due_date && new Date(t.due_date) < today,
      ).length;

      // Recent apps for the side panel — keep simple, scoped to my firms
      const myFirmIds = myFirms.map((f) => f.id);
      const recentRes = myFirmIds.length
        ? await supabase
            .from("client_applications")
            .select("id, client_name, status, updated_at")
            .in("firm_id", myFirmIds)
            .order("updated_at", { ascending: false })
            .limit(6)
        : { data: [] as any[] };

      // Ops personal: applications I'm assigned to that hit approved+ in last 30d
      let myApproved30 = 0;
      if (isOps || isAdmin) {
        const { data: myApps } = await supabase
          .from("client_applications")
          .select("id, status, updated_at")
          .eq("assigned_to", uid)
          .in("status", APPROVED_STATUSES)
          .gte("updated_at", days30.toISOString());
        myApproved30 = excludeDemoRecords(myApps ?? []).length;
      }

      // Team-wide scope (sales lead)
      let teamSignedUp30 = 0,
        teamActive = 0,
        teamOpen = 0;
      if (isSalesLead || isAdmin) {
        const { data: salesRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["sales", "sales_team_lead"]);
        const salesIds = Array.from(new Set((salesRoles ?? []).map((r) => r.user_id)));
        if (salesIds.length) {
          const [{ data: teamFirms }, { data: teamTasks }] = await Promise.all([
            supabase
              .from("firms")
              .select("id, sales_status, archived, created_at, assigned_account_manager")
              .in("assigned_account_manager", salesIds),
            supabase
              .from("tasks")
              .select("id, status")
              .in("assigned_to", salesIds)
              .neq("status", "completed")
              .neq("status", "cancelled"),
          ]);
          const tf = excludeDemoRecords((teamFirms ?? []).filter((f) => !f.archived));
          teamSignedUp30 = tf.filter(
            (f) => f.sales_status === "signed_up" && new Date(f.created_at) >= days30,
          ).length;
          teamActive = tf.filter(
            (f) => f.sales_status === "signed_up" && new Date(f.created_at) >= months6,
          ).length;
          teamOpen = excludeDemoRecords(teamTasks ?? []).length;
        }
      }

      // Ops team-wide scope (ops lead + admin)
      let opsTeamApproved30 = 0,
        opsTeamOpen = 0;
      if (isOpsLead || isAdmin) {
        const { data: opsRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .in("role", ["operations", "operations_team_lead"]);
        const opsIds = Array.from(new Set((opsRoles ?? []).map((r) => r.user_id)));
        // Approved apps count: for ops lead scope to ops team; admin = all
        const approvedQuery = supabase
          .from("client_applications")
          .select("id", { count: "exact", head: true })
          .in("status", APPROVED_STATUSES)
          .gte("updated_at", days30.toISOString());
        const { count: approvedCount } = isAdmin
          ? await approvedQuery
          : await approvedQuery.in("assigned_to", opsIds);
        opsTeamApproved30 = approvedCount ?? 0;

        if (opsIds.length && isOpsLead) {
          const { data: opsTasks } = await supabase
            .from("tasks")
            .select("id")
            .in("assigned_to", opsIds)
            .neq("status", "completed")
            .neq("status", "cancelled");
          opsTeamOpen = excludeDemoRecords(opsTasks ?? []).length;
        }
      }

      return {
        mySignedUp30,
        myActive,
        myOpen,
        myOverdue,
        teamSignedUp30,
        teamActive,
        teamOpen,
        myApproved30,
        opsTeamApproved30,
        opsTeamOpen,
        recentApps: excludeDemoRecords(recentRes.data),
      };
    },
  });

  // Tasks panel — assigned to me first, then unassigned. Open tasks only.
  const { data: tasks = [] } = useQuery({
    queryKey: ["dashboard-tasks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select(
          "id, title, due_date, priority, status, task_type, assigned_to, firm_id, application_id, firms(id,name), client_applications(id,client_name), profiles:assigned_to(id, full_name, email)",
        )
        .or(`assigned_to.eq.${user!.id},assigned_to.is.null`)
        .neq("status", "completed")
        .neq("status", "cancelled")
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(50);
      const rows = excludeDemoRecords(data);
      const mine = rows.filter((t) => t.assigned_to === user!.id);
      const others = rows.filter((t) => t.assigned_to !== user!.id);
      return [...mine, ...others].slice(0, 12);
    },
  });

  const completeTask = async (id: string, currentlyAssignedTo: string | null) => {
    const update: any = { status: "completed", completed_at: new Date().toISOString() };
    if (!currentlyAssignedTo && user?.id) update.assigned_to = user.id;
    const { error } = await supabase.from("tasks").update(update).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    qc.invalidateQueries({ queryKey: ["recently-completed-tasks"] });
    toast.success("Task completed");
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = (d: string | null) => !!d && new Date(d) < today;

  return (
    <div className="p-6 space-y-6 max-w-[1600px]">
      {isAdmin && user?.id && <FirmDeletedNotifications userId={user.id} />}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{getDailyPhrase()}</p>
      </div>

      <section className="space-y-3">
        {isAdmin ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric
              label="Clients Signed Up"
              value={m?.teamSignedUp30 ?? "…"}
              to="/firms"
              hint="Entire sales team · last 30 days"
            />
            <Metric
              label="My Open Tasks"
              value={m?.myOpen ?? "…"}
              to="/tasks"
              overdueCount={m?.myOverdue}
            />
            <Metric
              label="Applications Approved"
              value={m?.opsTeamApproved30 ?? "…"}
              to="/applications"
              hint="All teams · last 30 days"
            />
          </div>
        ) : isSales ? (
          <>
            {isSalesLead && (
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                My numbers
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Metric
                label="Clients Signed Up"
                value={m?.mySignedUp30 ?? "…"}
                to="/firms"
                hint="Last 30 days"
              />
              <Metric
                label="My Open Tasks"
                value={m?.myOpen ?? "…"}
                to="/tasks"
                overdueCount={m?.myOverdue}
              />
              <Metric
                label="My Active Firms"
                value={m?.myActive ?? "…"}
                to="/firms"
                hint="Signed up in last 6 months"
              />
            </div>
            {isSalesLead && (
              <>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
                  Team totals
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Metric
                    label="Team Clients Signed Up"
                    value={m?.teamSignedUp30 ?? "…"}
                    to="/firms"
                    hint="Last 30 days"
                  />
                  <Metric
                    label="Team Open Tasks"
                    value={m?.teamOpen ?? "…"}
                    to="/tasks"
                    hint="All sales reps"
                  />
                  <Metric
                    label="Team Active Firms"
                    value={m?.teamActive ?? "…"}
                    to="/firms"
                    hint="Signed up in last 6 months"
                  />
                </div>
              </>
            )}
          </>
        ) : isOps ? (
          <>
            {isOpsLead && (
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                My numbers
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Metric
                label="Applications Approved"
                value={m?.myApproved30 ?? "…"}
                to="/applications"
                hint="Assigned to me · last 30 days"
              />
              <Metric
                label="My Open Tasks"
                value={m?.myOpen ?? "…"}
                to="/tasks"
                overdueCount={m?.myOverdue}
              />
              <Metric label="Support Tickets Solved" value={0} hint="Tracking coming soon" />
            </div>
            {isOpsLead && (
              <>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-1">
                  Team totals
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Metric
                    label="Team Applications Approved"
                    value={m?.opsTeamApproved30 ?? "…"}
                    to="/applications"
                    hint="All ops · last 30 days"
                  />
                  <Metric
                    label="Team Open Tasks"
                    value={m?.opsTeamOpen ?? "…"}
                    to="/tasks"
                    hint="All operations reps"
                  />
                  <Metric
                    label="Team Support Tickets Solved"
                    value={0}
                    hint="Tracking coming soon"
                  />
                </div>
              </>
            )}
          </>
        ) : null}
      </section>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">My Tasks</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{tasks.length} open</span>
              <NewTaskDialog
                currentUserId={user!.id}
                currentUserName={profile?.full_name || profile?.email || "Me"}
                isAdmin={isAdmin}
                isSalesLead={hasRole("sales_team_lead")}
                isOpsLead={hasRole("operations_team_lead")}
                onCreated={() => qc.invalidateQueries({ queryKey: ["dashboard-tasks"] })}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasks.map((t: any) => {
              const related = t.firms?.name || t.client_applications?.client_name;
              const relatedLink = t.client_applications
                ? {
                    to: "/applications/$applicationId" as const,
                    params: { applicationId: t.client_applications.id },
                  }
                : t.firms
                  ? { to: "/firms/$firmId" as const, params: { firmId: t.firms.id } }
                  : null;
              return (
                <div
                  key={t.id}
                  className="flex items-start gap-3 pb-2 border-b last:border-0 last:pb-0"
                >
                  <Checkbox
                    className="mt-1"
                    onCheckedChange={() => completeTask(t.id, t.assigned_to)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{t.title}</span>
                      <StatusBadge value={t.priority} tone={priorityTone(t.priority)} />
                      <StatusBadge value={t.status} tone={taskTone(t.status)} />
                      {t.assigned_to ? (
                        <span className="text-[11px] text-muted-foreground">
                          Assigned to{" "}
                          {t.profiles?.full_name ||
                            t.profiles?.email ||
                            (t.assigned_to === user?.id ? "me" : "user")}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Unassigned</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {titleize(t.task_type)}
                      {related && relatedLink && (
                        <>
                          {" "}
                          ·{" "}
                          <Link {...relatedLink} className="hover:text-primary">
                            {related}
                          </Link>
                        </>
                      )}
                      {t.due_date && (
                        <>
                          {" "}
                          ·{" "}
                          <span
                            className={isOverdue(t.due_date) ? "text-destructive font-medium" : ""}
                          >
                            Due {fmtDate(t.due_date)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {!tasks.length && (
              <div className="text-xs text-muted-foreground py-4 text-center">
                No open tasks. 🎉
              </div>
            )}
          </CardContent>
        </Card>

        <RecentlyCompletedTasksCard
          currentUserId={user!.id}
          isAdmin={isAdmin}
          isSalesLead={isSalesLead}
          isOpsLead={isOpsLead}
        />
      </div>
    </div>
  );
}

type AssigneeOption = { id: string; name: string; roles: AppRole[] };

function NewTaskDialog({
  currentUserId,
  currentUserName,
  isAdmin,
  isSalesLead,
  isOpsLead,
  onCreated,
}: {
  currentUserId: string;
  currentUserName: string;
  isAdmin: boolean;
  isSalesLead: boolean;
  isOpsLead: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState(currentUserId);
  const [saving, setSaving] = useState(false);

  const canAssignOthers = isAdmin || isSalesLead || isOpsLead;

  const { data: assignees = [] } = useQuery({
    queryKey: ["assignable-users", isAdmin, isSalesLead, isOpsLead],
    enabled: open && canAssignOthers,
    queryFn: async (): Promise<AssigneeOption[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").eq("active", true),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const byUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        byUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.full_name || p.email || "Unknown",
        roles: byUser.get(p.id) ?? [],
      }));
    },
  });

  const visibleAssignees = useMemo(() => {
    const self: AssigneeOption = { id: currentUserId, name: `${currentUserName} (me)`, roles: [] };
    if (!canAssignOthers) return [self];
    const filtered = assignees.filter((a) => {
      if (a.id === currentUserId) return false;
      if (isAdmin) return true;
      if (isSalesLead && a.roles.some((r) => r === "sales" || r === "sales_team_lead")) return true;
      if (isOpsLead && a.roles.some((r) => r === "operations" || r === "operations_team_lead"))
        return true;
      return false;
    });
    return [self, ...filtered];
  }, [assignees, canAssignOthers, isAdmin, isSalesLead, isOpsLead, currentUserId, currentUserName]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      title,
      due_date: dueDate || null,
      priority: priority as any,
      assigned_to: assignee,
      created_by: currentUserId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Task created");
    setTitle("");
    setDueDate("");
    setPriority("medium");
    setAssignee(currentUserId);
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Task
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label>Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "mt-2 justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? (
                      format(new Date(dueDate + "T00:00:00"), "PPP")
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                    onSelect={(d) => setDueDate(d ? format(d, "yyyy-MM-dd") : "")}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["low", "medium", "high", "urgent"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {titleize(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {canAssignOthers && (
            <div>
              <Label>Assign to</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {visibleAssignees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.roles.length
                        ? ` — ${a.roles.map((r) => ROLE_LABEL[r] ?? r).join(", ")}`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saving || !title.trim()}>
              {saving ? "Creating…" : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecentlyCompletedTasksCard({
  currentUserId,
  isAdmin,
  isSalesLead,
  isOpsLead,
}: {
  currentUserId: string;
  isAdmin: boolean;
  isSalesLead: boolean;
  isOpsLead: boolean;
}) {
  const qc = useQueryClient();
  const canToggle = isAdmin || isSalesLead || isOpsLead;
  const [scope, setScope] = useState<"mine" | "team">("mine");

  const { data: teamIds = [] } = useQuery({
    queryKey: ["completed-team-ids", isAdmin, isSalesLead, isOpsLead],
    enabled: canToggle,
    queryFn: async () => {
      if (isAdmin) return null as string[] | null; // null = no filter (all users)
      const roles: AppRole[] = isSalesLead
        ? ["sales", "sales_team_lead"]
        : ["operations", "operations_team_lead"];
      const { data } = await supabase.from("user_roles").select("user_id").in("role", roles);
      return Array.from(new Set((data ?? []).map((r) => r.user_id)));
    },
  });

  const sevenDaysAgoIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const { data: completed = [] } = useQuery({
    queryKey: ["recently-completed-tasks", currentUserId, scope, teamIds],
    queryFn: async () => {
      let q = supabase
        .from("tasks")
        .select(
          "id, title, completed_at, assigned_to, firm_id, application_id, firms(id,name), client_applications(id,client_name), profiles:assigned_to(id, full_name, email)",
        )
        .eq("status", "completed")
        .gte("completed_at", sevenDaysAgoIso)
        .order("completed_at", { ascending: false })
        .limit(20);
      if (scope === "mine") {
        q = q.or(`assigned_to.eq.${currentUserId},assigned_to.is.null`);
      } else if (teamIds && teamIds.length) {
        q = q.in("assigned_to", teamIds);
      }
      const { data } = await q;
      return excludeDemoRecords(data);
    },
  });

  const restoreTask = async (id: string) => {
    const { error } = await supabase
      .from("tasks")
      .update({ status: "open", completed_at: null })
      .eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["recently-completed-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    toast.success("Task restored");
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Recently Completed Tasks</CardTitle>
        {canToggle && (
          <div className="flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setScope("mine")}
              className={cn(
                "px-2 py-1",
                scope === "mine" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Mine
            </button>
            <button
              type="button"
              onClick={() => setScope("team")}
              className={cn(
                "px-2 py-1 border-l",
                scope === "team" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Team
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-[11px] text-muted-foreground">Auto-removed after 7 days.</p>
        {completed.map((t: any) => {
          const related = t.firms?.name || t.client_applications?.client_name;
          const relatedLink = t.client_applications
            ? {
                to: "/applications/$applicationId" as const,
                params: { applicationId: t.client_applications.id },
              }
            : t.firms
              ? { to: "/firms/$firmId" as const, params: { firmId: t.firms.id } }
              : null;
          const assigneeName = t.profiles?.full_name || t.profiles?.email;
          return (
            <div
              key={t.id}
              className="flex items-start justify-between gap-2 pb-2 border-b last:border-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{t.title}</div>
                <div className="text-xs text-muted-foreground">
                  Completed {fmtDate(t.completed_at)}
                  {related && relatedLink && (
                    <>
                      {" "}
                      ·{" "}
                      <Link {...relatedLink} className="hover:text-primary">
                        {related}
                      </Link>
                    </>
                  )}
                  {scope === "team" && assigneeName && <> · {assigneeName}</>}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => restoreTask(t.id)}
                title="Restore to My Tasks"
              >
                <Undo2 className="h-3.5 w-3.5 mr-1" />
                Restore
              </Button>
            </div>
          );
        })}
        {!completed.length && (
          <div className="text-xs text-muted-foreground py-2">
            No tasks completed in the last 7 days.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
