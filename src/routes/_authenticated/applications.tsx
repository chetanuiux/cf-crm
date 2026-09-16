import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RefreshCw, ExternalLink, Files, Play, XCircle, UserPlus, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { applicationTone, fmtDate, fmtMoney } from "@/lib/labels";
import { toast } from "sonner";
import {
  listPlatformApplications,
  mapPlatformStatus,
  platformApplicationUrl,
  platformStatusLabel,
} from "@/lib/platform-applications";

export const Route = createFileRoute("/_authenticated/applications")({ component: ApplicationsRoute });


function ApplicationsRoute() {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const { canViewApplications, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !canViewApplications) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, canViewApplications, navigate]);

  if (pathname !== "/applications" && pathname !== "/applications/") return <Outlet />;
  if (loading || !canViewApplications) return null;
  return <ApplicationsPage />;
}

function ApplicationsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [attorney, setAttorney] = useState("all");

  const { data: rows = [], isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["platform-applications"],
    queryFn: listPlatformApplications,
    refetchInterval: 60_000,
  });

  const attorneyOptions = Array.from(
    new Set(rows.map(r => r.attorney_name || r.attorney_email || '').filter(Boolean))
  ).sort();

  const filtered = rows.filter((r) => {
    const label = platformStatusLabel(r.status);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.client_name.toLowerCase().includes(q) ||
      (r.firm_name ?? '').toLowerCase().includes(q) ||
      (r.client_email ?? '').toLowerCase().includes(q);
    const matchesStatus =
      status === 'all' ||
      (status === 'None' && !r.status?.trim()) ||
      label === status;
    const attorneyKey = r.attorney_name || r.attorney_email || '';
    const matchesAttorney = attorney === 'all' || attorneyKey === attorney;
    return matchesSearch && matchesStatus && matchesAttorney;
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast.success('Applications refreshed from CaseFunders site');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Refresh failed');
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Applications</h1>
          <p className="text-sm text-muted-foreground">
            Live from www.casefunders.com — {filtered.length} of {rows.length} shown (not stored in CRM)
          </p>
          {error && (
            <p className="text-sm text-destructive mt-1">
              {error instanceof Error ? error.message : 'Could not load applications'}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void handleRefresh()}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total Applications",  count: rows.length,                                                    badge: "All",     value: "all",                 icon: Files,         color: "bg-blue-50 text-blue-600 border-blue-200"   },
          { label: "Application Started", count: rows.filter(r => r.status?.trim() === "Application Started").length, badge: "Started", value: "Application Started", icon: Play,          color: "bg-indigo-50 text-indigo-600 border-indigo-200" },
          { label: "No Offer",            count: rows.filter(r => r.status?.trim() === "No Offer").length,            badge: "No Offer",value: "No Offer",            icon: XCircle,       color: "bg-rose-50 text-rose-600 border-rose-200"   },
          { label: "Client Invited",      count: rows.filter(r => r.status?.trim() === "Client Invited").length,      badge: "Invited", value: "Client Invited",      icon: UserPlus,      color: "bg-purple-50 text-purple-600 border-purple-200" },
          { label: "Application Error",   count: rows.filter(r => r.status?.trim() === "Error").length,               badge: "Error",   value: "Error",               icon: AlertTriangle, color: "bg-red-50 text-red-600 border-red-200"      },
        ].map(({ label, count, badge, value, icon: Icon, color }) => (
          <Card key={value} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatus(value)}>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-1">{label}</p>
              <div className="flex items-end justify-between gap-2">
                <span className="text-3xl font-bold">{isLoading ? "—" : count}</span>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border ${color} ${status === value ? "ring-2 ring-offset-1 ring-current" : ""}`}
                >
                  <Icon className="h-3 w-3" />
                  {badge}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          <Input placeholder="Search client, firm, email…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={attorney} onValueChange={setAttorney}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="All attorneys" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All attorneys</SelectItem>
              {attorneyOptions.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-50 max-w-50">Client</TableHead>
              <TableHead>Firm</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attorney</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[80px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading from site…</TableCell></TableRow>
            ) : filtered.map((r) => {
              const url = platformApplicationUrl(r);
              const crmStatus = mapPlatformStatus(r.status, r.funded_amount);
              return (
                <TableRow key={r.session_id} className="hover:bg-muted/50">
                  <TableCell className="font-medium max-w-50 truncate" title={r.client_name}>{r.client_name}</TableCell>
                  <TableCell>{r.firm_name ?? '—'}</TableCell>
                  <TableCell>{fmtMoney(r.loan_amount)}</TableCell>
                  <TableCell>
                    <StatusBadge value={platformStatusLabel(r.status)} tone={applicationTone(crmStatus)} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.attorney_name || r.attorney_email || '—'}</TableCell>
                  <TableCell className="text-sm">{fmtDate(r.updated_at)}</TableCell>
                  <TableCell>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && !filtered.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No applications match.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
