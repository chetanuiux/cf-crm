import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtMoney, fmtDate } from "@/lib/labels";
import { excludeDemoRecords } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/commissions")({ component: CommissionsPage });

// Commission model (configurable later): sales rep earns 1% of funded amount on
// applications they (or the firm's account manager) own.
const COMMISSION_RATE = 0.01;

function CommissionsPage() {
  const { user, hasRole, isAdmin } = useAuth();

  const { data } = useQuery({
    queryKey: ["commissions", user?.id, isAdmin],
    enabled: !!user,
    queryFn: async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const qtrStart = new Date(); qtrStart.setMonth(Math.floor(qtrStart.getMonth()/3)*3, 1); qtrStart.setHours(0,0,0,0);

      // Pull funded payments joined with apps + firms, then attribute to a sales owner.
      const { data: rows } = await supabase
        .from("payments")
        .select("id, funded_amount, actual_funding_date, status, application_id, firm_id, client_applications(id, client_name, assigned_to), firms(id, name, assigned_account_manager)")
        .not("actual_funding_date", "is", null)
        .order("actual_funding_date", { ascending: false });

      const list = excludeDemoRecords(rows ?? []).map((r: any) => {
        const owner = r.client_applications?.assigned_to ?? r.firms?.assigned_account_manager ?? null;
        return {
          id: r.id,
          owner_id: owner,
          firm_id: r.firm_id,
          firm_name: r.firms?.name ?? "—",
          app_id: r.application_id,
          client_name: r.client_applications?.client_name ?? "—",
          funded_at: r.actual_funding_date,
          funded_amount: Number(r.funded_amount || 0),
          commission: Number(r.funded_amount || 0) * COMMISSION_RATE,
        };
      });

      const mine = isAdmin ? list : list.filter(x => x.owner_id === user!.id);

      const sum = (arr: typeof mine, from: Date) =>
        arr.filter(x => new Date(x.funded_at) >= from).reduce((s, x) => s + x.commission, 0);

      return {
        rows: mine,
        mtd: sum(mine, monthStart),
        qtd: sum(mine, qtrStart),
        ytd: sum(mine, new Date(new Date().getFullYear(), 0, 1)),
        totalFunded: mine.reduce((s, x) => s + x.funded_amount, 0),
      };
    },
  });

  if (!hasRole(["sales", "sales_team_lead", "super_admin", "admin"])) {
    return <div className="p-6"><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Commissions is restricted to Sales and Admins.</CardContent></Card></div>;
  }

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-semibold">Commissions & Tracking</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Team-wide funded deals and commission attribution." : "Your funded deals and earned commission."}
          {" "}Rate: {(COMMISSION_RATE * 100).toFixed(1)}% of funded amount.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">MTD Commission</div><div className="mt-1 text-2xl font-semibold">{fmtMoney(data?.mtd ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">QTD Commission</div><div className="mt-1 text-2xl font-semibold">{fmtMoney(data?.qtd ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">YTD Commission</div><div className="mt-1 text-2xl font-semibold">{fmtMoney(data?.ytd ?? 0)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase tracking-wide">Total Funded (attributed)</div><div className="mt-1 text-2xl font-semibold">{fmtMoney(data?.totalFunded ?? 0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Funded Deals</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Funded</TableHead><TableHead>Client</TableHead><TableHead>Firm</TableHead><TableHead className="text-right">Funded Amount</TableHead><TableHead className="text-right">Commission</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data?.rows ?? []).map(r => (
                <TableRow key={r.id}>
                  <TableCell>{fmtDate(r.funded_at)}</TableCell>
                  <TableCell><Link to="/applications/$applicationId" params={{ applicationId: r.app_id }} className="hover:text-primary">{r.client_name}</Link></TableCell>
                  <TableCell><Link to="/firms/$firmId" params={{ firmId: r.firm_id }} className="hover:text-primary">{r.firm_name}</Link></TableCell>
                  <TableCell className="text-right">{fmtMoney(r.funded_amount)}</TableCell>
                  <TableCell className="text-right font-medium">{fmtMoney(r.commission)}</TableCell>
                </TableRow>
              ))}
              {!data?.rows?.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No funded deals attributed yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
