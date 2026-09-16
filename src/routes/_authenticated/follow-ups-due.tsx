import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { salesStatusTone, fmtDate } from "@/lib/labels";
import { formatPhone } from "@/lib/format-phone";
import { excludeDemoRecords } from "@/lib/demo-data";
import { PAGE_SIZES, DEFAULT_PAGE_SIZE, type PageSize } from "@/lib/pagination";
import { BellRing, Building, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

// Firms that are closed out don't need a follow-up nudge.
const CLOSED_STATUSES = new Set(["signed_up", "lost_not_interested"]);

const DUE_FILTERS = ["due", "overdue", "today", "upcoming", "all"] as const;
type DueFilter = (typeof DUE_FILTERS)[number];

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
    rep: (raw.rep as string) || "all",
    q: (raw.q as string) || "",
  }),
});

type FirmRow = {
  id: string;
  name: string;
  main_contact_name: string | null;
  email: string | null;
  phone: string | null;
  sales_status: string;
  assigned_account_manager: string | null;
  next_follow_up_date: string | null;
  reconnect_date: string | null;
};

type DueBucket = "overdue" | "today" | "upcoming" | "later";

type DueRow = FirmRow & {
  dueDate: string;
  dueKind: "Follow-up" | "Reconnect";
  bucket: DueBucket;
  daysDiff: number;
};

// A firm can carry both a next_follow_up_date and a reconnect_date — surface
// whichever comes first as "the" thing the rep needs to act on.
function computeDueRows(firms: FirmRow[]): DueRow[] {
  const today = todayStr();
  const rows: DueRow[] = [];
  for (const f of firms) {
    const candidates: { date: string; kind: "Follow-up" | "Reconnect" }[] = [];
    if (f.next_follow_up_date) candidates.push({ date: f.next_follow_up_date, kind: "Follow-up" });
    if (f.reconnect_date) candidates.push({ date: f.reconnect_date, kind: "Reconnect" });
    if (!candidates.length) continue;
    candidates.sort((a, b) => a.date.localeCompare(b.date));
    const { date, kind } = candidates[0];
    const daysDiff = Math.round((new Date(date).getTime() - new Date(today).getTime()) / 86_400_000);
    const bucket: DueBucket = daysDiff < 0 ? "overdue" : daysDiff === 0 ? "today" : daysDiff <= 7 ? "upcoming" : "later";
    rows.push({ ...f, dueDate: date, dueKind: kind, bucket, daysDiff });
  }
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
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
  const { user, roles } = useAuth();
  const navigate = Route.useNavigate();
  const { page, limit, due, rep, q } = Route.useSearch();

  const isLeadOrAdmin = roles.some((r) => ["super_admin", "admin", "sales_team_lead"].includes(r));

  // Local input state so the field is responsive; debounce before hitting the URL
  const [searchInput, setSearchInput] = useState(q);
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
  const setRep = (val: string) => navigate({ search: (prev) => ({ ...prev, rep: val, page: 1 }) });
  const setLimit = (val: string) => navigate({ search: (prev) => ({ ...prev, limit: Number(val) as PageSize, page: 1 }) });
  const goTo = (p: number) => navigate({ search: (prev) => ({ ...prev, page: p }) });

  const { data: salesReps = [] } = useQuery({
    queryKey: ["sales-reps-follow-ups"],
    enabled: isLeadOrAdmin,
    queryFn: async () => {
      const { data: ur } = await supabase.from("user_roles").select("user_id").in("role", ["sales", "sales_team_lead"]);
      const ids = Array.from(new Set((ur ?? []).map((r) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      return profs ?? [];
    },
  });

  const { data, isLoading, isPlaceholderData, isError, refetch } = useQuery({
    queryKey: ["follow-ups-due", user?.id, isLeadOrAdmin, due, rep, q],
    placeholderData: keepPreviousData,
    enabled: !!user,
    queryFn: async () => {
      // NOTE: this reads firms.next_follow_up_date / reconnect_date directly.
      // Shiv is wiring the backend rules that keep those dates (and a real
      // "follow_up_due" notifications row) up to date — this page will pick
      // those changes up automatically once that lands.
      let query = supabase
        .from("firms")
        .select("id,name,main_contact_name,email,phone,sales_status,assigned_account_manager,next_follow_up_date,reconnect_date")
        .eq("archived", false);

      if (isLeadOrAdmin) {
        if (rep !== "all") query = query.eq("assigned_account_manager", rep);
      } else {
        query = query.eq("assigned_account_manager", user!.id);
      }

      const { data: rows, error } = await query;
      if (error) throw error;

      const open = excludeDemoRecords(rows).filter((f) => !CLOSED_STATUSES.has(f.sales_status));
      let dueRows = computeDueRows(open as FirmRow[]);

      if (due !== "all") {
        dueRows = dueRows.filter((r) => (due === "due" ? r.bucket === "overdue" || r.bucket === "today" : r.bucket === due));
      }
      if (q.trim()) {
        const safe = q.trim().toLowerCase();
        dueRows = dueRows.filter(
          (r) => r.name.toLowerCase().includes(safe) || (r.main_contact_name ?? "").toLowerCase().includes(safe),
        );
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
  const colSpan = isLeadOrAdmin ? 6 : 5;

  const repName = (id: string | null) => {
    if (!id) return "Unassigned";
    const p = salesReps.find((r) => r.id === id);
    return p?.full_name || p?.email || "—";
  };

  const previewFirm = rows[0];
  const previewNotification = () => {
    if (previewFirm) {
      toast.info(`Follow-up due: ${previewFirm.name}`, {
        description: dueLabel(previewFirm),
        action: {
          label: "View firm",
          onClick: () => navigate({ to: "/firms/$firmId", params: { firmId: previewFirm.id } }),
        },
      });
    } else {
      toast.info("Follow-up due: Smith & Associates", { description: "3d overdue" });
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
          Law firms the sales team needs to follow up with, based on each firm's next follow-up / reconnect date.
        </p>
      </div>

      {/* Notification preview — a mockup so the team can see the target look before Shiv wires the real trigger. */}
      <Card className="border-dashed">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-xs font-medium">
                Follow-up due: {previewFirm?.name ?? "Smith & Associates"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {previewFirm ? dueLabel(previewFirm) : "3d overdue"} - this is how it will appear in the notification bell
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={previewNotification}>
            Preview toast
          </Button>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search firm or contact…"
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
          {isLeadOrAdmin && (
            <Select value={rep} onValueChange={setRep}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="All reps" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All reps</SelectItem>
                {salesReps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card className={isPlaceholderData ? "opacity-60 pointer-events-none" : ""}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firm</TableHead>
              <TableHead>Contact</TableHead>
              {isLeadOrAdmin && <TableHead>Assigned rep</TableHead>}
              <TableHead>Sales status</TableHead>
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
                  Nothing due - you're all caught up.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((f) => (
                <TableRow
                  key={f.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => navigate({ to: "/firms/$firmId", params: { firmId: f.id } })}
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Building className="h-3.5 w-3.5 text-muted-foreground" />
                      {f.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{f.main_contact_name || "—"}</div>
                    {f.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3" />{f.email}
                      </div>
                    )}
                    {f.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />{formatPhone(f.phone)}
                      </div>
                    )}
                  </TableCell>
                  {isLeadOrAdmin && <TableCell className="text-sm">{repName(f.assigned_account_manager)}</TableCell>}
                  <TableCell><StatusBadge value={f.sales_status} tone={salesStatusTone(f.sales_status)} /></TableCell>
                  <TableCell>
                    <StatusBadge value={dueLabel(f)} tone={dueBadgeTone(f.bucket)} />
                    <div className="text-xs text-muted-foreground mt-1">{f.dueKind} • {fmtDate(f.dueDate)}</div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => navigate({ to: "/firms/$firmId", params: { firmId: f.id } })}>
                      View firm
                    </Button>
                  </TableCell>
                </TableRow>
              ))
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
          entityLabel="firms"
          onPageChange={goTo}
          onLimitChange={(l) => setLimit(String(l))}
        />
      )}
    </div>
  );
}
