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
import { toast } from "sonner";
import { formatPhone } from "@/lib/format-phone";
import { fmtDateUTC, fmtTimeUTC, fmtLocalDateTime, formatLocation } from "@/lib/labels";
import { Building, Mail, Phone, Trash2 } from "lucide-react";
import { canConvertLead } from "@/lib/lead-permissions";
import { useRowSelection } from "@/hooks/use-row-selection";
import { applyDemoLeadFilters, excludeDemoRecords } from "@/lib/demo-data";
import { PAGE_SIZES, DEFAULT_PAGE_SIZE, type PageSize } from "@/lib/pagination";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/leads")({
  component: LeadsPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    page: Math.max(1, Number(raw.page) || 1),
    limit: (PAGE_SIZES as readonly number[]).includes(Number(raw.limit))
      ? (Number(raw.limit) as PageSize)
      : DEFAULT_PAGE_SIZE,
    channel: (raw.channel as string) || "all",
    status: (raw.status as string) || "new",
    q: (raw.q as string) || "",
  }),
});

const CHANNELS = ["all", "website", "linkedin", "calendly", "callrail", "manual", "anonymous_client_flow"] as const;
const STATUSES = ["all", "new", "converted", "dismissed"] as const;

function channelLabel(ch: string) {
  if (ch === "all") return "All channels";
  if (ch === "anonymous_client_flow") return "Anonymous Client Flow";
  if (ch === "linkedin") return "LinkedIn";
  return ch;
}

// Frontend-only display filter: when multiple leads share the same identity
// (email/phone/name), keep just the earliest-submitted one and hide the rest.
function dedupeLeadsByFirstSubmitted<T extends Record<string, unknown>>(rows: T[]): T[] {
  const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
  const keyOf = (lead: T) =>
    // Matches the Lawyer, Client, Firm, and Location columns shown in the table.
    [
      norm(lead.name),
      norm(lead.email),
      norm(lead.phone),
      norm(lead.message),
      norm(lead.client_name),
      norm(lead.company),
      norm(lead.city),
      norm(lead.state),
    ].join("|");

  const earliestByKey = new Map<string, T>();
  for (const lead of rows) {
    const key = keyOf(lead);
    const existing = earliestByKey.get(key);
    if (!existing || new Date(lead.created_at as string).getTime() < new Date(existing.created_at as string).getTime()) {
      earliestByKey.set(key, lead);
    }
  }
  return rows.filter((lead) => earliestByKey.get(keyOf(lead)) === lead);
}

function channelTone(ch: string) {
  if (ch === "website") return "success" as const;
  if (ch === "linkedin") return "info" as const;
  if (ch === "calendly") return "info" as const;
  if (ch === "callrail") return "warning" as const;
  if (ch === "anonymous_client_flow") return "info" as const;
  return "neutral" as const;
}

function LeadsPage() {
  const { user, roles, isSuperAdmin } = useAuth();
  const showLeadActions = true;
  const qc = useQueryClient();
  const { page, limit, channel, status, q } = Route.useSearch();
  const navigate = Route.useNavigate();

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

  const setChannel = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, channel: val, page: 1 }) });
  const setStatus = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, status: val, page: 1 }) });
  const setLimit = (val: string) =>
    navigate({ search: (prev) => ({ ...prev, limit: Number(val) as PageSize, page: 1 }) });
  const goTo = (p: number) => navigate({ search: (prev) => ({ ...prev, page: p }) });

  const { data, isLoading, isPlaceholderData, isError, refetch } = useQuery({
    queryKey: ["leads-page", page, limit, channel, status, q],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      // Fetch all matching rows (unpaginated) so duplicates can be collapsed
      // before pagination is computed — otherwise hiding dupes on a page
      // would desync the page's row count from the reported total.
      let query = applyDemoLeadFilters(
        supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false }),
      );

      if (channel !== "all")
        query = query.eq("channel", channel as "website" | "manual" | "callrail" | "calendly" | "anonymous_client_flow" | "linkedin");
      if (status !== "all") query = query.eq("status", status as "new" | "converted" | "dismissed");
      if (q.trim()) {
        const safe = q.trim();
        query = query.or(
          `name.ilike.%${safe}%,company.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,message.ilike.%${safe}%,client_name.ilike.%${safe}%`,
        );
      }

      const { data: rows, error } = await query;
      if (error) throw error;
      const deduped = dedupeLeadsByFirstSubmitted(excludeDemoRecords(rows));
      const total = deduped.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const from = (page - 1) * limit;
      const pageRows = deduped.slice(from, from + limit);
      return { rows: pageRows, total, totalPages };
    },
  });

  // Clamp to last valid page if filters shrink the result set
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
  const colSpan = (showLeadActions ? 9 : 8) + (isSuperAdmin ? 1 : 0);

  const leadIds = rows.map((lead) => lead.id as string);
  const { selected, toggle, toggleAll, clear, allSelected, someSelected } = useRowSelection(leadIds);

  const bulkDeleteLeads = async (ids: string[]) => {
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) {
      toast.error(error.message || "Failed to delete leads");
      throw error;
    }
    toast.success(`${ids.length} lead${ids.length === 1 ? "" : "s"} deleted`);
    clear();
    qc.invalidateQueries({ queryKey: ["leads-page"] });
    qc.invalidateQueries({ queryKey: ["new-leads-count"] });
  };

  const convertToFirm = async (lead: Record<string, unknown>) => {
    const leadSourceMap: Record<string, "website" | "partner" | "linkedin" | "google_ads" | "other"> = {
      website: "website",
      linkedin: "linkedin",
      calendly: "website",
      callrail: "other",
      manual: "other",
      anonymous_client_flow: "other",
    };
    const { data: firm, error } = await supabase
      .from("firms")
      .insert({
        name: (lead.company as string) || (lead.name as string) || "Unnamed Firm",
        main_contact_name: lead.name as string,
        client_name: (lead.client_name as string) || null,
        email: lead.email as string,
        phone: lead.phone as string,
        lead_source: leadSourceMap[lead.channel as string] ?? "website",
        sales_status: "new_lead",
        created_by: user?.id ?? null,
        assigned_account_manager: user?.id ?? null,
      })
      .select("id")
      .single();

    if (error || !firm) {
      toast.error(error?.message || "Failed to create firm");
      return;
    }

    const { error: updateErr } = await supabase
      .from("leads")
      .update({
        status: "converted",
        converted_firm_id: firm.id,
        converted_by: user?.id ?? null,
        converted_at: new Date().toISOString(),
      })
      .eq("id", lead.id as string);

    if (updateErr) toast.error(updateErr.message);
    else toast.success("Lead converted to firm");
    qc.invalidateQueries({ queryKey: ["leads-page"] });
    qc.invalidateQueries({ queryKey: ["new-leads-count"] });
  };

  const dismissLead = async (leadId: string) => {
    const { error } = await supabase.from("leads").update({ status: "dismissed" }).eq("id", leadId);
    if (error) toast.error(error.message);
    else toast.success("Lead dismissed");
    qc.invalidateQueries({ queryKey: ["leads-page"] });
    qc.invalidateQueries({ queryKey: ["new-leads-count"] });
  };

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="text-sm text-muted-foreground">
          Incoming leads from the marketing site, LinkedIn Ads, Calendly, CallRail, anonymous client flow, and manual entry.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Input
            placeholder="Search name, firm, email…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="max-w-xs"
          />
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {channelLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "all" ? "All statuses" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isSuperAdmin && (
        <BulkDeleteBar
          count={selected.size}
          itemLabel="lead"
          onConfirm={() => bulkDeleteLeads(Array.from(selected))}
        />
      )}

      {/* Table */}
      <Card className={isPlaceholderData ? "opacity-60 pointer-events-none" : ""}>
        <Table>
          <TableHeader>
            <TableRow>
              {isSuperAdmin && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(!!v)}
                    aria-label="Select all leads on this page"
                  />
                </TableHead>
              )}
              <TableHead>Lawyer</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Firm</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              {showLeadActions && <TableHead className="text-right">Actions</TableHead>}
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
                  <p className="text-muted-foreground mb-2">Failed to load leads.</p>
                  <Button size="sm" variant="outline" onClick={() => refetch()}>
                    Retry
                  </Button>
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-muted-foreground py-8 text-center">
                  No leads found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((lead) => (
                <TableRow key={lead.id}>
                  {isSuperAdmin && (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={(v) => toggle(lead.id, !!v)}
                        aria-label={`Select lead ${lead.name ?? lead.id}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="font-medium">{lead.name}</div>
                    {lead.email && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3" />
                        {lead.email}
                      </div>
                    )}
                    {lead.phone && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {formatPhone(lead.phone)}
                      </div>
                    )}
                    {lead.message && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-xs line-clamp-2">
                        {lead.message}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{(lead as any).client_name || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-muted-foreground" />
                      {lead.company || "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatLocation((lead as any).city, (lead as any).state)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">
                      {(lead as any).funding_amount || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={lead.channel === "linkedin" ? "LinkedIn" : lead.channel} tone={channelTone(lead.channel)} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      value={lead.status}
                      tone={
                        lead.status === "new"
                          ? "warning"
                          : lead.status === "converted"
                            ? "success"
                            : "neutral"
                      }
                    />
                  </TableCell>
                  <TableCell
                    className="whitespace-nowrap"
                    title={`Local: ${fmtLocalDateTime(lead.created_at)}`}
                  >
                    <div className="text-sm text-muted-foreground">
                      {fmtDateUTC(lead.created_at)}
                    </div>
                    <div className="text-xs text-muted-foreground/70">
                      {fmtTimeUTC(lead.created_at)}
                    </div>
                  </TableCell>
                  {showLeadActions && (
                    <TableCell className="text-right space-x-1">
                      {lead.status === "new" && (
                        <>
                          {canConvertLead(roles) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => convertToFirm(lead as Record<string, unknown>)}
                            >
                              Convert
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => dismissLead(lead.id)}
                            title="Delete lead"
                            aria-label="Delete lead"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination bar — only shown when there are results */}
      {!isLoading && !isError && total > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          from={from}
          to={to}
          limit={limit}
          entityLabel="leads"
          onPageChange={goTo}
          onLimitChange={(l) => setLimit(String(l))}
        />
      )}
    </div>
  );
}
