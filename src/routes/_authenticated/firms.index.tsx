import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { PaginationBar } from "@/components/PaginationBar";
import { StateCombobox } from "@/components/StateCombobox";
import { salesStatusTone, onboardingTone, fmtDate, fmtDateTime, statusLabel } from "@/lib/labels";
import { SALES_FLOW, SALES_BRANCHES, ONBOARDING_FLOW } from "@/lib/pipeline-status";
import { formatPhone } from "@/lib/format-phone";
import { toast } from "sonner";
import { applyDemoFirmFilters, excludeDemoRecords } from "@/lib/demo-data";
import { PAGE_SIZES, DEFAULT_PAGE_SIZE, type PageSize } from "@/lib/pagination";

const SALES = [...SALES_FLOW, ...SALES_BRANCHES] as const;
const ONBOARD = ["not_started", ...ONBOARDING_FLOW] as const;

export const Route = createFileRoute("/_authenticated/firms/")({
  component: FirmsPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    page: Math.max(1, Number(raw.page) || 1),
    limit: (PAGE_SIZES as readonly number[]).includes(Number(raw.limit))
      ? (Number(raw.limit) as PageSize)
      : DEFAULT_PAGE_SIZE,
    status: (raw.status as string) || "all",
    q: (raw.q as string) || "",
  }),
});

function FirmsPage() {
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { profile, canWrite } = useAuth();
  const { page, limit, status, q } = Route.useSearch();

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

  // Sync input if URL q changes externally (back/forward nav)
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const setStatus = (val: string) => navigate({ search: (prev) => ({ ...prev, status: val, page: 1 }) });
  const setLimit = (l: number) => navigate({ search: (prev) => ({ ...prev, limit: l as PageSize, page: 1 }) });
  const goTo = (p: number) => navigate({ search: (prev) => ({ ...prev, page: p }) });
  const clearFilters = () => navigate({ search: (prev) => ({ ...prev, q: "", status: "all", page: 1 }) });

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", main_contact_name: "", email: "", phone: "", state: "" });

  const createFirm = async () => {
    const name = form.name.trim();
    if (!name) return toast.error("Firm name is required");
    if (name.length > 200) return toast.error("Firm name too long");
    setSaving(true);
    const { data, error } = await supabase.from("firms").insert({
      name,
      main_contact_name: form.main_contact_name.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      state: form.state.trim() || null,
      created_by: profile?.id ?? null,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Firm created");
    setOpen(false);
    setForm({ name: "", main_contact_name: "", email: "", phone: "", state: "" });
    qc.invalidateQueries({ queryKey: ["firms-page"] });
    if (data?.id) navigate({ to: "/firms/$firmId", params: { firmId: data.id } });
  };

  const archiveFirm = async (firmId: string) => {
    const { error } = await supabase.from("firms").update({ archived: true }).eq("id", firmId);
    if (error) return toast.error(error.message);
    toast.success("Firm deleted");
    qc.invalidateQueries({ queryKey: ["firms-page"] });
  };

  const { data, isLoading, isPlaceholderData, isError, refetch } = useQuery({
    queryKey: ["firms-page", page, limit, status, q],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const [filterKind, filterValue] = status === "all" ? ["all", ""] : status.split(":");

      let query = applyDemoFirmFilters(
        supabase
          .from("firms")
          .select("*", { count: "exact" })
          .eq("archived", false)
          .order("updated_at", { ascending: false }),
      ).range(from, to);

      if (filterKind === "sales") query = query.eq("sales_status", filterValue as (typeof SALES)[number]);
      if (filterKind === "onboarding") query = query.eq("onboarding_status", filterValue as (typeof ONBOARD)[number]);
      if (q.trim()) {
        const safe = q.trim();
        query = query.or(
          `name.ilike.%${safe}%,main_contact_name.ilike.%${safe}%,client_name.ilike.%${safe}%,email.ilike.%${safe}%`,
        );
      }

      const { data: rows, error, count } = await query;
      if (error) throw error;
      const filtered = excludeDemoRecords(rows);
      const total = count ?? filtered.length;
      return { rows: filtered, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    },
  });

  // Clamp to last valid page if filters shrink the result set
  useEffect(() => {
    if (data?.totalPages && page > data.totalPages) {
      navigate({ search: (prev) => ({ ...prev, page: data.totalPages }) });
    }
  }, [data?.totalPages, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const firms = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const colSpan = 6;

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Firms</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canWrite}>+ New Firm</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create new firm</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1"><Label>Firm name *</Label><Input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} maxLength={200} /></div>
              <div className="space-y-1"><Label>Main contact</Label><Input value={form.main_contact_name} onChange={e=>setForm({...form, main_contact_name: e.target.value})} maxLength={120} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e=>setForm({...form, email: e.target.value})} maxLength={200} /></div>
                <div className="space-y-1"><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} maxLength={40} /></div>
              </div>
              <div className="space-y-1"><Label>State</Label><StateCombobox value={form.state} onChange={(v)=>setForm({...form, state: v})} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
              <Button onClick={createFirm} disabled={saving || !form.name.trim()}>{saving ? "Creating…" : "Create firm"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Input placeholder="Search firms…" value={searchInput} onChange={e=>setSearchInput(e.target.value)} className="max-w-xs" />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[240px]"><SelectValue placeholder="Filter by status…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All law firms</SelectItem>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Sales status</SelectLabel>
                {SALES.map(s => <SelectItem key={`sales:${s}`} value={`sales:${s}`}>{statusLabel(s)}</SelectItem>)}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Onboarding stage</SelectLabel>
                {ONBOARD.map(s => <SelectItem key={`onboarding:${s}`} value={`onboarding:${s}`}>{statusLabel(s)}</SelectItem>)}
              </SelectGroup>
            </SelectContent>
          </Select>
          {(q || status !== "all") && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className={isPlaceholderData ? "opacity-60 pointer-events-none" : ""}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firm</TableHead>
              <TableHead>Main contact</TableHead>
              <TableHead>Sales</TableHead>
              <TableHead>Onboarding</TableHead>
              <TableHead>Last Activity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: limit }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: colSpan }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8">
                  <p className="text-muted-foreground mb-2">Failed to load firms.</p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ) : firms.length === 0 ? (
              <TableRow><TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8">No firms match these filters.</TableCell></TableRow>
            ) : (
              firms.map(f => (
                <TableRow key={f.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/firms/$firmId", params: { firmId: f.id } })}>
                  <TableCell>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.email}</div>
                  </TableCell>
                  <TableCell>{f.main_contact_name}<div className="text-xs text-muted-foreground">{formatPhone(f.phone)}</div></TableCell>
                  <TableCell><StatusBadge value={f.sales_status} tone={salesStatusTone(f.sales_status)} /></TableCell>
                  <TableCell><StatusBadge value={f.onboarding_status} tone={onboardingTone(f.onboarding_status)} /></TableCell>
                  <TableCell className="text-sm">{fmtDateTime(f.last_activity_date)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); archiveFirm(f.id); }}
                      title="Delete firm"
                      aria-label="Delete firm"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
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
          onLimitChange={setLimit}
        />
      )}
    </div>
  );
}
