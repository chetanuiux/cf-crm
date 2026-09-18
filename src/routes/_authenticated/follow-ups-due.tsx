import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { PaginationBar } from "@/components/PaginationBar";
import { BulkDeleteBar } from "@/components/BulkDeleteBar";
import { Checkbox } from "@/components/ui/checkbox";
import { salesStatusTone, applicationTone, fmtDateTime } from "@/lib/labels";
import { PAGE_SIZES, DEFAULT_PAGE_SIZE, type PageSize } from "@/lib/pagination";
import { completeFollowUp } from "@/lib/follow-up-api";
import { useRowSelection } from "@/hooks/use-row-selection";
import { BellRing, Building, FileText } from "lucide-react";
import { toast } from "sonner";

const DUE_FILTERS = ["due", "overdue", "today", "upcoming", "all"] as const;
type DueFilter = (typeof DUE_FILTERS)[number];
const KIND_FILTERS = ["all", "sales", "application"] as const;
type KindFilter = (typeof KIND_FILTERS)[number];

function dueFilterLabel(f: DueFilter) {
  switch (f) {
    case "due": return "Due now (overdue + today)";
    case "overdue": return "Overdue";
    case "today": return "Due today";
    case "upcoming": return "Upcoming (7 days)";
    case "all": return "All scheduled";
  }
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export const Route = createFileRoute("/_authenticated/follow-ups-due")({
  component: FollowUpsDuePage,
  validateSearch: (raw: Record<string, unknown>) => ({
    page: Math.max(1, Number(raw.page) || 1),
    limit: (PAGE_SIZES as readonly number[]).includes(Number(raw.limit))
      ? (Number(raw.limit) as PageSize)
      : DEFAULT_PAGE_SIZE,
    due: (DUE_FILTERS as readonly string[]).includes(raw.due as string) ? (raw.due as DueFilter) : "due",
    kind: (KIND_FILTERS as readonly string[]).includes(raw.kind as string) ? (raw.kind as KindFilter) : "all",
    rep: (raw.rep as string) || "all",
    q: (raw.q as string) || "",
  }),
});

type FollowUpRow = {
  id: string;
  kind: "sales" | "application";
  source: string;
  status: string;
  pipeline_status: string;
  due_at: string;
  is_internal: boolean;
  title: string;
  message: string;
  firm_id: string | null;
  platform_session_id: string | null;
  assigned_to: string | null;
  firms: { id: string; name: string } | null;
  platform_applications: { session_id: string; client_name: string; firm_name: string | null } | null;
};

type DueBucket = "overdue" | "today" | "upcoming" | "later";

type DueRow = FollowUpRow & {
  bucket: DueBucket;
  daysDiff: number;
};

function bucketFor(dueAt: string): { bucket: DueBucket; daysDiff: number } {
  const today = todayStr();
  const date = dueAt.slice(0, 10);
  const daysDiff = Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86_400_000);
  const bucket: DueBucket = daysDiff < 0 ? "overdue" : daysDiff === 0 ? "today" : daysDiff <= 7 ? "upcoming" : "later";
  return { bucket, daysDiff };
}

function dueBadgeTone(bucket: DueBucket) {
  if (bucket === "overdue") return "destructive" as const;
  if (bucket === "today") return "warning" as const;
  if (bucket === "upcoming") return "info" as const;
  return "muted" as const;
}

function dueLabel(row: DueRow) {
  if (row.bucket === "overdue") return `${Math.abs(row.daysDiff)}d overdue`;
  if (row.bucket === "today") return "Due today";
  if (row.daysDiff === 1) return "Due tomorrow";
  return `In ${row.daysDiff}d`;
}

function FollowUpsDuePage() {
  const { user, roles, isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = Route.useNavigate();
  const { page, limit, due, kind, rep, q } = Route.useSearch();

  const isLeadOrAdmin = roles.some((r) => ["super_admin", "admin", "sales_team_lead", "operations_team_lead"].includes(r));
  const canSeeApps = roles.some((r) => ["super_admin", "admin", "operations", "operations_team_lead"].includes(r));
  const canSeeSales = roles.some((r) => ["super_admin", "admin", "sales", "sales_team_lead"].includes(r));

  const [searchInput, setSearchInput] = useState(q);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const timer = setTimeout(() => {
      navigate({ search: (prev) => ({ ...prev, q: searchInput.trim(), page: 1 }) });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSearchInput(q); }, [q]);

  const setDue = (val: string) => navigate({ search: (prev) => ({ ...prev, due: val as DueFilter, page: 1 }) });
  const setKind = (val: string) => navigate({ search: (prev) => ({ ...prev, kind: val as KindFilter, page: 1 }) });
  const setRep = (val: string) => navigate({ search: (prev) => ({ ...prev, rep: val, page: 1 }) });
  const setLimit = (val: string) => navigate({ search: (prev) => ({ ...prev, limit: Number(val) as PageSize, page: 1 }) });
  const goTo = (p: number) => navigate({ search: (prev) => ({ ...prev, page: p }) });

  const { data: salesReps = [] } = useQuery({
    queryKey: ["sales-reps-follow-ups"],
    enabled: isLeadOrAdmin,
    queryFn: async () => {
      const { data: ur } = await supabase.from("user_roles").select("user_id").in("role", ["sales", "sales_team_lead", "operations", "operations_team_lead"]);
      const ids = Array.from(new Set((ur ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      return profs ?? [];
    },
  });

  const { data, isLoading, isPlaceholderData, isError, refetch } = useQuery({
    queryKey: ["follow-ups-due", user?.id, isLeadOrAdmin, due, kind, rep, q],
    placeholderData: keepPreviousData,
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("follow_ups")
        .select("id,kind,source,status,pipeline_status,due_at,is_internal,title,message,firm_id,platform_session_id,assigned_to,firms(id,name),platform_applications(session_id,client_name,firm_name)")
        .in("status", ["pending", "notified"])
        .order("due_at", { ascending: true });

      if (!isLeadOrAdmin) query = query.eq("assigned_to", user!.id);
      else if (rep !== "all") query = query.eq("assigned_to", rep);

      if (kind !== "all") query = query.eq("kind", kind);
      else if (!canSeeApps && canSeeSales) query = query.eq("kind", "sales");
      else if (canSeeApps && !canSeeSales) query = query.eq("kind", "application");

      const { data: rows, error } = await query;
      if (error) throw error;

      let dueRows: DueRow[] = ((rows ?? []) as unknown as FollowUpRow[]).map((r) => {
        const { bucket, daysDiff } = bucketFor(r.due_at);
        return { ...r, bucket, daysDiff };
      });

      if (due !== "all") {
        dueRows = dueRows.filter((r) => (due === "due" ? r.bucket === "overdue" || r.bucket === "today" : r.bucket === due));
      }
      if (q.trim()) {
        const safe = q.trim().toLowerCase();
        dueRows = dueRows.filter((r) => {
          const firm = r.firms?.name ?? "";
          const client = r.platform_applications?.client_name ?? "";
          return firm.toLowerCase().includes(safe) || client.toLowerCase().includes(safe) || r.title.toLowerCase().includes(safe);
        });
      }

      const total = dueRows.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const from = (page - 1) * limit;
      return { rows: dueRows.slice(from, from + limit), total, totalPages };
    },
  });

  useEffect(() => {
    if (data?.totalPages && page > data.totalPages) {
      navigate({ search: (prev) => ({ ...prev, page: data.totalPages }) });
    }
  }, [data?.totalPages, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const colSpan = (isLeadOrAdmin ? 7 : 6) + (isSuperAdmin ? 1 : 0);

  const followUpIds = rows.map((f) => f.id);
  const { selected, toggle, toggleAll, clear, allSelected, someSelected } = useRowSelection(followUpIds);

  const bulkDeleteFollowUps = async (ids: string[]) => {
    const { error } = await supabase.from("follow_ups").delete().in("id", ids);
    if (error) {
      toast.error(error.message || "Failed to delete follow-ups");
      throw error;
    }
    toast.success(`${ids.length} follow-up${ids.length === 1 ? "" : "s"} deleted`);
    clear();
    qc.invalidateQueries({ queryKey: ["follow-ups-due"] });
    qc.invalidateQueries({ queryKey: ["follow-ups-due-count"] });
  };

  const repName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = salesReps.find((r) => r.id === id);
    return p?.full_name || p?.email || "—";
  };

  const openRow = (f: DueRow) => {
    if (f.kind === "sales" && f.firm_id) {
      navigate({ to: "/firms/$firmId", params: { firmId: f.firm_id } });
    } else if (f.kind === "application" && f.platform_session_id) {
      navigate({ to: "/applications", search: { session: f.platform_session_id } });
    } else {
      navigate({ to: "/applications" });
    }
  };

  const onComplete = async (id: string) => {
    setCompletingId(id);
    try {
      await completeFollowUp(id);
      toast.success("Follow-up completed. Next cadence item scheduled if the status is unchanged.");
      qc.invalidateQueries({ queryKey: ["follow-ups-due"] });
      qc.invalidateQueries({ queryKey: ["follow-ups-due-count"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete follow-up");
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <BellRing className="h-5 w-5" />
          Follow Ups Due
        </h1>
        <p className="text-sm text-muted-foreground">
          Automatic and manual follow-ups for attorney sales and client applications. Completing one schedules the next using that status’s cadence, unless you set a specific date.
        </p>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search firm or client…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-xs"
          />
          <Select value={due} onValueChange={setDue}>
            <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DUE_FILTERS.map((f) => (
                <SelectItem key={f} value={f}>{dueFilterLabel(f)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="sales">Attorney sales</SelectItem>
              <SelectItem value="application">Applications</SelectItem>
            </SelectContent>
          </Select>
          {isLeadOrAdmin && (
            <Select value={rep} onValueChange={setRep}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All reps" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                {salesReps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <BulkDeleteBar
          count={selected.size}
          itemLabel="follow-up"
          onConfirm={() => bulkDeleteFollowUps(Array.from(selected))}
        />
      )}

      <Card className={isPlaceholderData ? "opacity-60 pointer-events-none" : ""}>
        <Table>
          <TableHeader>
            <TableRow>
              {isSuperAdmin && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(!!v)}
                    aria-label="Select all follow-ups on this page"
                  />
                </TableHead>
              )}
              <TableHead>Record</TableHead>
              <TableHead>Type</TableHead>
              {isLeadOrAdmin && <TableHead>Assigned</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: limit }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colSpan }).map((__, j) => (
                    <TableCell key={j}><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8">
                  <p className="text-muted-foreground mb-2">Failed to load follow-ups.</p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-muted-foreground py-8 text-center">
                  Nothing due — you're all caught up.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((f) => {
                const name = f.kind === "sales"
                  ? (f.firms?.name ?? "Firm")
                  : (f.platform_applications?.client_name ?? "Application");
                const sub = f.kind === "application" ? f.platform_applications?.firm_name : null;
                return (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => openRow(f)}
                  >
                    {isSuperAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(f.id)}
                          onCheckedChange={(v) => toggle(f.id, !!v)}
                          aria-label={`Select follow-up ${f.title ?? f.id}`}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium">
                        {f.kind === "sales" ? <Building className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
                        {name}
                      </div>
                      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
                      {f.is_internal && <div className="text-[11px] text-muted-foreground mt-0.5">Internal review — contact the firm only if they need to act</div>}
                    </TableCell>
                    <TableCell className="text-sm">{f.kind === "sales" ? "Sales" : "Application"}{f.source === "manual" ? " · Manual" : ""}</TableCell>
                    {isLeadOrAdmin && <TableCell className="text-sm">{repName(f.assigned_to)}</TableCell>}
                    <TableCell>
                      <StatusBadge
                        value={f.pipeline_status}
                        tone={f.kind === "sales" ? salesStatusTone(f.pipeline_status) : applicationTone(f.pipeline_status)}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={dueLabel(f)} tone={dueBadgeTone(f.bucket)} />
                      <div className="text-xs text-muted-foreground mt-1">{fmtDateTime(f.due_at)}</div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openRow(f)}>
                          View
                        </Button>
                        <Button size="sm" disabled={completingId === f.id} onClick={() => onComplete(f.id)}>
                          {completingId === f.id ? "Saving…" : "Complete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {!isLoading && !isError && total > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          from={from}
          to={to}
          limit={limit}
          entityLabel="follow-ups"
          onPageChange={goTo}
          onLimitChange={(l) => setLimit(String(l))}
        />
      )}
    </div>
  );
}
