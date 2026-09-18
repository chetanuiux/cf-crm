import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtMoney, titleize } from "@/lib/labels";
import { excludeDemoRecords } from "@/lib/demo-data";

export const Route = createFileRoute("/_authenticated/reports")({ component: ReportsPage });

function ReportsPage() {
  const { data: d } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const [apps, pays, tasks, firms] = await Promise.all([
        supabase.from("client_applications").select("id, firm_id, client_email, status, funding_status, submitted_date, created_at"),
        supabase.from("payments").select("id, firm_id, application_id, funded_amount, status, actual_funding_date"),
        supabase.from("tasks").select("id, firm_id, application_id, status, due_date"),
        supabase.from("firms").select("id, email, sales_status, onboarding_status, payment_status, last_activity_date"),
      ]);
      const a = excludeDemoRecords(apps.data);
      const p = excludeDemoRecords(pays.data);
      const t = excludeDemoRecords(tasks.data);
      const f = excludeDemoRecords(firms.data);
      const byStatus: Record<string, number> = {}; a.forEach(x => byStatus[x.status] = (byStatus[x.status]||0)+1);
      const payByStatus: Record<string, number> = {}; p.forEach(x => payByStatus[x.status] = (payByStatus[x.status]||0)+1);
      const fundedVol = p.reduce((s,x)=>s+Number(x.funded_amount||0),0);
      const decided = a.filter(x => ["approved","funded","paid_to_firm","declined","no_offers"].includes(x.status));
      const approved = a.filter(x => ["approved","funded","paid_to_firm","client_selected_offer"].includes(x.status));
      return {
        appCount: a.length,
        fundedVol,
        avgFunded: p.filter(x=>x.funded_amount).length ? fundedVol / p.filter(x=>x.funded_amount).length : 0,
        approvalRate: decided.length ? Math.round(approved.length / decided.length * 100) : 0,
        byStatus, payByStatus,
        tasksCompleted: t.filter(x=>x.status==="completed").length,
        tasksOverdue: t.filter(x=>x.status==="overdue").length,
        firmsSignedUp: f.filter(x=>x.sales_status==="signed_up").length,
        readyFirstApp: f.filter(x=>x.onboarding_status==="onboarding_approved" || x.onboarding_status==="ready_for_first_application").length,
        paySetupPending: f.filter(x=>!["verified_ready","disabled"].includes(x.payment_status)).length,
      };
    },
  });
  const Stat = ({ label, value }: { label: string; value: any }) => (
    <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></CardContent></Card>
  );
  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div><h1 className="text-2xl font-semibold">Reports</h1><p className="text-sm text-muted-foreground">Lifetime summary across all firms and applications.</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Applications" value={d?.appCount ?? "…"} />
        <Stat label="Funded Volume" value={fmtMoney(d?.fundedVol ?? 0)} />
        <Stat label="Avg Funded" value={fmtMoney(d?.avgFunded ?? 0)} />
        <Stat label="Approval Rate" value={`${d?.approvalRate ?? 0}%`} />
        <Stat label="Firms Signed Up" value={d?.firmsSignedUp ?? "…"} />
        <Stat label="Ready for 1st App" value={d?.readyFirstApp ?? "…"} />
        <Stat label="Pay Setup Pending" value={d?.paySetupPending ?? "…"} />
        <Stat label="Tasks Completed/Overdue" value={`${d?.tasksCompleted ?? 0} / ${d?.tasksOverdue ?? 0}`} />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle className="text-base">Applications by Status</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
          {Object.entries(d?.byStatus ?? {}).map(([k,v]) => <div key={k} className="flex justify-between border-b py-1"><span>{titleize(k)}</span><span className="font-medium">{v as number}</span></div>)}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Payments by Status</CardTitle></CardHeader><CardContent className="space-y-1 text-sm">
          {Object.entries(d?.payByStatus ?? {}).map(([k,v]) => <div key={k} className="flex justify-between border-b py-1"><span>{titleize(k)}</span><span className="font-medium">{v as number}</span></div>)}
        </CardContent></Card>
      </div>
    </div>
  );
}
