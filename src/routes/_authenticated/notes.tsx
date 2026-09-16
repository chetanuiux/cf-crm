import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDateTime, titleize, ROLE_LABEL } from "@/lib/labels";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/lib/auth";
import type { AppRole } from "@/lib/auth";
import { excludeDemoRecords } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/notes")({ component: NotesPage });

type FilterValue = "all" | "mine" | "sales" | "operations";

const SALES_ROLES: AppRole[] = ["sales", "sales_team_lead"];
const OPS_ROLES: AppRole[] = ["operations", "operations_team_lead"];

function NotesPage() {
  const { user, roles, isAdmin } = useAuth();

  const { data: rows = [] } = useQuery({
    queryKey: ["notes-all"],
    queryFn: async () =>
      excludeDemoRecords(
        (await supabase
          .from("notes")
          .select("*, profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(500)).data,
      ),
  });

  const { data: rolesMap = {} } = useQuery({
    queryKey: ["user-roles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      const m: Record<string, AppRole[]> = {};
      (data ?? []).forEach((r: any) => {
        (m[r.user_id] ??= []).push(r.role as AppRole);
      });
      return m;
    },
  });

  const isSalesLead = roles.includes("sales_team_lead");
  const isOpsLead = roles.includes("operations_team_lead");

  const options = useMemo(() => {
    const opts: { value: FilterValue; label: string }[] = [];
    if (isAdmin || isSalesLead || isOpsLead) opts.push({ value: "all", label: "All notes" });
    opts.push({ value: "mine", label: "My notes" });
    if (isAdmin || isSalesLead) opts.push({ value: "sales", label: "Sales team notes" });
    if (isAdmin || isOpsLead) opts.push({ value: "operations", label: "Operations team notes" });
    return opts;
  }, [isAdmin, isSalesLead, isOpsLead]);

  const defaultFilter: FilterValue = isAdmin || isSalesLead || isOpsLead ? "all" : "mine";
  const [filter, setFilter] = useState<FilterValue>(defaultFilter);
  useEffect(() => { setFilter(defaultFilter); }, [defaultFilter]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "mine") return rows.filter((n: any) => n.created_by === user?.id);
    const teamRoles = filter === "sales" ? SALES_ROLES : OPS_ROLES;
    return rows.filter((n: any) => {
      if (n.created_by_role && teamRoles.includes(n.created_by_role)) return true;
      const userRoles = n.created_by ? rolesMap[n.created_by] ?? [] : [];
      return userRoles.some(r => teamRoles.includes(r));
    });
  }, [rows, filter, user?.id, rolesMap]);

  return (
    <div className="p-6 space-y-3 max-w-4xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} notes (most recent first)</p>
        </div>
        <div className="w-60">
          <Label className="text-xs text-muted-foreground">View</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterValue)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {filtered.map((n: any) => (
        <Card key={n.id}><CardContent className="p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span className="flex items-center gap-2">
              <StatusBadge value={n.note_type} tone="info" />
              <span>· {titleize(n.related_record_type)}</span>
              <span>· {n.profiles?.full_name || (n.created_by_role ? ROLE_LABEL[n.created_by_role] : "System")}</span>
            </span>
            <span>{fmtDateTime(n.created_at)}{n.edited && " · edited"}</span>
          </div>
          <div className="text-sm whitespace-pre-wrap">{n.note_body}</div>
        </CardContent></Card>
      ))}
      {!filtered.length && <p className="text-sm text-muted-foreground text-center py-8">No notes.</p>}
    </div>
  );
}
