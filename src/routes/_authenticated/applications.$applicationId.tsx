import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { applicationTone, fundingTone, paymentTone, offerTone, taskTone, fmtDate, fmtDateTime, fmtMoney, titleize, ROLE_LABEL } from "@/lib/labels";
import { toast } from "sonner";
import { formatPhone } from "@/lib/format-phone";

export const Route = createFileRoute("/_authenticated/applications/$applicationId")({ component: AppDetail });

function AppDetail() {
  const { applicationId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { profile, roles, canWrite, canViewApplications, loading } = useAuth();

  useEffect(() => {
    if (!loading && !canViewApplications) {
      navigate({ to: "/dashboard" });
    }
  }, [loading, canViewApplications, navigate]);

  if (loading || !canViewApplications) return null;

  const { data: app } = useQuery({ queryKey: ["app", applicationId], queryFn: async () => (await supabase.from("client_applications").select("*, firms(id, name)").eq("id", applicationId).single()).data });
  const { data: offers = [] } = useQuery({ queryKey: ["app-offers", applicationId], queryFn: async () => (await supabase.from("lender_offers").select("*, lenders(name)").eq("application_id", applicationId)).data ?? [] });
  const { data: payments = [] } = useQuery({ queryKey: ["app-payments", applicationId], queryFn: async () => (await supabase.from("payments").select("*").eq("application_id", applicationId)).data ?? [] });
  const { data: tasks = [] } = useQuery({ queryKey: ["app-tasks", applicationId], queryFn: async () => (await supabase.from("tasks").select("*").eq("application_id", applicationId)).data ?? [] });
  const { data: notes = [] } = useQuery({ queryKey: ["app-notes", applicationId], queryFn: async () => (await supabase.from("notes").select("*").eq("related_record_type","application").eq("related_record_id", applicationId).order("created_at",{ascending:false})).data ?? [] });
  const { data: activity = [] } = useQuery({ queryKey: ["app-activity", applicationId], queryFn: async () => (await supabase.from("activity_logs").select("*").eq("related_record_type","application").eq("related_record_id", applicationId).order("created_at",{ascending:false})).data ?? [] });
  const { data: lenders = [] } = useQuery({ queryKey: ["lenders-active"], queryFn: async () => (await supabase.from("lenders").select("id, name").eq("archived", false).eq("active", true).order("name")).data ?? [] });

  const [noteBody, setNoteBody] = useState("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [offerForm, setOfferForm] = useState({ lender_id: "", offer_amount: "", apr: "", term_months: "", estimated_monthly_payment: "", offer_expiration_date: "" });

  const createOffer = async () => {
    if (!offerForm.lender_id) return toast.error("Select a lender");
    setSavingOffer(true);
    const { error } = await supabase.from("lender_offers").insert({
      application_id: applicationId,
      lender_id: offerForm.lender_id,
      offer_amount: offerForm.offer_amount ? Number(offerForm.offer_amount) : null,
      apr: offerForm.apr ? Number(offerForm.apr) : null,
      term_months: offerForm.term_months ? Number(offerForm.term_months) : null,
      estimated_monthly_payment: offerForm.estimated_monthly_payment ? Number(offerForm.estimated_monthly_payment) : null,
      offer_expiration_date: offerForm.offer_expiration_date || null,
      created_by: profile?.id ?? null,
    } as any);
    setSavingOffer(false);
    if (error) return toast.error(error.message);
    setOfferOpen(false);
    setOfferForm({ lender_id: "", offer_amount: "", apr: "", term_months: "", estimated_monthly_payment: "", offer_expiration_date: "" });
    qc.invalidateQueries({ queryKey: ["app-offers", applicationId] });
    toast.success("Offer added");
  };

  const addNote = async () => {
    if (!noteBody.trim()) return;
    const { error } = await supabase.from("notes").insert({
      related_record_type: "application", related_record_id: applicationId,
      note_type: "general", note_body: noteBody,
      created_by: profile?.id ?? null, created_by_role: roles[0] ?? null,
    });
    if (error) return toast.error(error.message);
    setNoteBody("");
    qc.invalidateQueries({ queryKey: ["app-notes", applicationId] });
    toast.success("Note added");
  };

  const toggleStuck = async () => {
    if (!app) return;
    const { error } = await supabase.from("client_applications").update({ stuck: !app.stuck, stuck_flagged_date: !app.stuck ? new Date().toISOString() : null } as any).eq("id", applicationId);
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert({
      related_record_type: "application", related_record_id: applicationId,
      action_type: app.stuck ? "stuck_resolved" : "stuck_flagged",
      description: app.stuck ? "Stuck flag removed" : "Application flagged as stuck",
      performed_by: profile?.id ?? null, performed_by_role: roles[0] ?? null,
    });
    qc.invalidateQueries({ queryKey: ["app", applicationId] });
    qc.invalidateQueries({ queryKey: ["app-activity", applicationId] });
  };

  if (!app) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <Link to="/applications" className="text-sm text-muted-foreground hover:text-foreground">← Applications</Link>

      {/* Client / application header card */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{app.client_name}</h1>
              <p className="text-sm mt-1">Firm: <Link className="text-primary hover:underline" to="/firms/$firmId" params={{ firmId: app.firm_id }}>{(app as any).firms?.name}</Link></p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <StatusBadge value={app.status} tone={applicationTone(app.status)} />
              <StatusBadge value={app.funding_status} tone={fundingTone(app.funding_status)} />
              <StatusBadge value={app.payment_to_firm_status} tone={paymentTone(app.payment_to_firm_status)} />
              {app.stuck && <StatusBadge value="stuck" tone="destructive" />}
              <Button size="sm" variant="outline" disabled={!canWrite} onClick={toggleStuck}>{app.stuck ? "Unflag stuck" : "Flag stuck"}</Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm pt-2 border-t">
            <div><div className="text-xs text-muted-foreground">Email</div><div>{app.client_email || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Phone</div><div>{formatPhone(app.client_phone) || "—"}</div></div>
            <div><div className="text-xs text-muted-foreground">Amount requested</div><div>{fmtMoney(app.amount_requested)}</div></div>
            <div><div className="text-xs text-muted-foreground">Case type</div><div>{app.case_type || "—"}</div></div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="offers">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="offers">Lender Offers ({offers.length})</TabsTrigger>
          <TabsTrigger value="overview">Details</TabsTrigger>
          <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity ({activity.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><Card><CardContent className="grid md:grid-cols-2 gap-x-6 gap-y-2 p-4 text-sm">
          {[
            ["Source", app.application_source],
            ["Link sent", fmtDate(app.link_sent_date)],
            ["Started", fmtDate(app.started_date)],
            ["Submitted", fmtDate(app.submitted_date)],
            ["Created", fmtDateTime(app.created_at)],
            ["Updated", fmtDateTime(app.updated_at)],
            ["Stuck reason", app.stuck_reason || "—"],
          ].map(([k,v]) => <div key={String(k)} className="flex justify-between border-b py-1"><span className="text-muted-foreground">{k}</span><span>{v as any}</span></div>)}
        </CardContent></Card></TabsContent>

        <TabsContent value="offers" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Lender Offers</h2>
            <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
              <DialogTrigger asChild><Button size="sm" disabled={!canWrite}>+ Add Lender Offer</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Lender Offer</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Lender *</Label>
                    <Select value={offerForm.lender_id} onValueChange={v => setOfferForm(f => ({ ...f, lender_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select lender" /></SelectTrigger>
                      <SelectContent>{lenders.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Offer amount</Label><Input type="number" value={offerForm.offer_amount} onChange={e => setOfferForm(f => ({ ...f, offer_amount: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>APR (%)</Label><Input type="number" step="0.01" value={offerForm.apr} onChange={e => setOfferForm(f => ({ ...f, apr: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Term (months)</Label><Input type="number" value={offerForm.term_months} onChange={e => setOfferForm(f => ({ ...f, term_months: e.target.value }))} /></div>
                    <div className="space-y-1.5"><Label>Est. monthly payment</Label><Input type="number" value={offerForm.estimated_monthly_payment} onChange={e => setOfferForm(f => ({ ...f, estimated_monthly_payment: e.target.value }))} /></div>
                    <div className="space-y-1.5 col-span-2"><Label>Expires</Label><Input type="date" value={offerForm.offer_expiration_date} onChange={e => setOfferForm(f => ({ ...f, offer_expiration_date: e.target.value }))} /></div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOfferOpen(false)}>Cancel</Button>
                  <Button onClick={createOffer} disabled={savingOffer}>{savingOffer ? "Saving…" : "Add Offer"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {offers.map((o: any) => (
              <Card key={o.id} className={o.selected_by_client ? "border-success" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold">{o.lenders?.name || "—"}</div>
                      {o.selected_by_client && <div className="text-xs text-success">★ Client selected</div>}
                    </div>
                    <StatusBadge value={o.status} tone={offerTone(o.status)} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><div className="text-xs text-muted-foreground">Amount</div><div className="font-medium">{fmtMoney(o.offer_amount)}</div></div>
                    <div><div className="text-xs text-muted-foreground">APR</div><div className="font-medium">{o.apr != null ? `${o.apr}%` : "—"}</div></div>
                    <div><div className="text-xs text-muted-foreground">Term</div><div>{o.term_months != null ? `${o.term_months} mo` : "—"}</div></div>
                    <div><div className="text-xs text-muted-foreground">Monthly</div><div>{fmtMoney(o.estimated_monthly_payment)}</div></div>
                    <div className="col-span-2"><div className="text-xs text-muted-foreground">Expires</div><div>{fmtDate(o.offer_expiration_date) || "—"}</div></div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {!offers.length && (
              <Card className="sm:col-span-2 lg:col-span-3"><CardContent className="p-8 text-center text-sm text-muted-foreground">No lender offers yet. Add one to get started.</CardContent></Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments"><Card><Table>
          <TableHeader><TableRow><TableHead>Funded</TableHead><TableHead>To Firm</TableHead><TableHead>Fee</TableHead><TableHead>Status</TableHead><TableHead>Funding date</TableHead></TableRow></TableHeader>
          <TableBody>{payments.map(p => <TableRow key={p.id}><TableCell>{fmtMoney(p.funded_amount)}</TableCell><TableCell>{fmtMoney(p.amount_expected_to_firm)}</TableCell><TableCell>{fmtMoney(p.casefunders_fee_amount)}</TableCell><TableCell><StatusBadge value={p.status} tone={paymentTone(p.status)} /></TableCell><TableCell>{fmtDate(p.actual_funding_date)}</TableCell></TableRow>)}
            {!payments.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No payments.</TableCell></TableRow>}
          </TableBody>
        </Table></Card></TabsContent>

        <TabsContent value="tasks"><Card><Table>
          <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{tasks.map(t => <TableRow key={t.id}><TableCell>{t.title}</TableCell><TableCell>{fmtDate(t.due_date)}</TableCell><TableCell><StatusBadge value={t.status} tone={taskTone(t.status)} /></TableCell></TableRow>)}
            {!tasks.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No tasks.</TableCell></TableRow>}
          </TableBody>
        </Table></Card></TabsContent>

        <TabsContent value="notes" className="space-y-3">
          <Card><CardContent className="p-3 space-y-2">
            <Textarea placeholder="Add a note…" value={noteBody} onChange={e=>setNoteBody(e.target.value)} disabled={!canWrite} />
            <div className="flex justify-end"><Button onClick={addNote} disabled={!canWrite || !noteBody.trim()}>Add note</Button></div>
          </CardContent></Card>
          {notes.map(n => (
            <Card key={n.id}><CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span><StatusBadge value={n.note_type} tone="info" /> · {n.created_by_role ? ROLE_LABEL[n.created_by_role] : "System"}</span>
                <span>{fmtDateTime(n.created_at)}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap">{n.note_body}</div>
            </CardContent></Card>
          ))}
          {!notes.length && <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>}
        </TabsContent>

        <TabsContent value="activity" className="space-y-2">
          {activity.map(a => (
            <Card key={a.id}><CardContent className="p-3 flex justify-between text-sm">
              <div><div className="font-medium">{a.description}</div><div className="text-xs text-muted-foreground">{titleize(a.action_type)}</div></div>
              <div className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</div>
            </CardContent></Card>
          ))}
          {!activity.length && <p className="text-sm text-muted-foreground text-center py-4">No activity.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
