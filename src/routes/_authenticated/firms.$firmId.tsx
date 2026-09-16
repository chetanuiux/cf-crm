import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { FlowStepper, type Step, type StepState } from "@/components/FlowStepper";
import { ChevronDown, Lock, Pencil, Check, X, Calendar as CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/format-phone";
import { isDemoFirmId, excludeDemoRecords } from "@/lib/demo-data";

function CollapsibleFlow({ title, steps, locked, lockedMessage, defaultOpen }: { title: string; steps: Step[]; locked?: boolean; lockedMessage?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  const currentStep = steps.find(s => s.state === "current" || s.state === "warning");
  const lastDone = [...steps].reverse().find(s => s.state === "complete");
  const summary = currentStep?.label ?? (lastDone ? `${lastDone.label} ✓` : "Not started");
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 py-1 group">
        <div className="flex items-center gap-2 min-w-0">
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          {locked && <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Lock className="h-3 w-3" />{lockedMessage}</span>}
          {!open && !locked && <span className="text-xs text-muted-foreground truncate">· {summary}</span>}
        </div>
      </button>
      {open && <div className="pt-3"><FlowStepper title="" steps={steps} locked={locked} lockedMessage={lockedMessage} /></div>}
    </div>
  );
}
import { salesStatusTone, onboardingTone, paymentSetupTone, applicationTone, paymentTone, taskTone, fmtDate, fmtDateTime, fmtMoney, titleize, ROLE_LABEL, formatLocation } from "@/lib/labels";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { toast } from "sonner";

function Field({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-full" : undefined}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words">{value || "—"}</div>
    </div>
  );
}

// Sales flow runs first; onboarding flow only begins once attorney has signed up.
const SALES_FLOW = ["new_lead","contacted","demo_booked","demo_completed","demo_completed_signed_up"] as const;
const SALES_BRANCHES = ["demo_no_show","demo_completed_didnt_sign_up","lost_not_interested","dnc"] as const;
const SALES_OPTIONS = [...SALES_FLOW, ...SALES_BRANCHES] as const;
const ONBOARDING_FLOW = ["signup_submitted","bank_account_connected","onboarding_done","completed_first_application","funded_three_cases"] as const;
const SALES_COMPLETE = "demo_completed_signed_up";
const SALES_TERMINAL_LOST = ["lost_not_interested","dnc","demo_completed_didnt_sign_up"];

function buildSalesSteps(current: string): Step[] {
  // demo_no_show is a warning state attached to demo_booked; otherwise follow main flow.
  if (SALES_TERMINAL_LOST.includes(current)) {
    return SALES_FLOW.map((k, i) => ({
      key: k, label: titleize(k),
      state: (i === 0 ? "complete" : i === SALES_FLOW.length - 1 ? "failed" : "upcoming") as StepState,
      sublabel: i === SALES_FLOW.length - 1 ? titleize(current) : undefined,
    }));
  }
  const effective = current === "demo_no_show" ? "demo_booked" : current;
  const idx = SALES_FLOW.indexOf(effective as any);
  return SALES_FLOW.map((k, i) => {
    let state: StepState = i < idx ? "complete" : i === idx ? "current" : "upcoming";
    if (k === "demo_booked" && current === "demo_no_show") state = "warning";
    if (i < idx && k !== "demo_booked") state = "complete";
    if (i === SALES_FLOW.length - 1 && current === SALES_COMPLETE) state = "complete";
    return { key: k, label: titleize(k), state, sublabel: k === "demo_booked" && current === "demo_no_show" ? "No-show — follow up" : undefined };
  });
}
function buildOnboardingSteps(current: string, locked: boolean): Step[] {
  const idx = ONBOARDING_FLOW.indexOf(current as any);
  return ONBOARDING_FLOW.map((k, i) => {
    let state: StepState = locked ? "locked" : i < idx ? "complete" : i === idx ? "current" : "upcoming";
    if (!locked && i === ONBOARDING_FLOW.length - 1 && current === "funded_three_cases") state = "complete";
    return { key: k, label: titleize(k), state };
  });
}

export const Route = createFileRoute("/_authenticated/firms/$firmId")({ component: FirmDetail });

const NOTE_TYPES = ["general","call_log","email","meeting","follow_up","support","payment_funding"];

function FirmDetail() {
  const { firmId } = Route.useParams();
  const qc = useQueryClient();
  const { profile, roles, canWrite, isAdmin, hasRole } = useAuth();
  const canDeleteFirm = isAdmin || (canWrite && !hasRole("support"));
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isDemoFirmId(firmId)) navigate({ to: "/firms", search: { page: 1, limit: DEFAULT_PAGE_SIZE, status: "all", q: "" } });
  }, [firmId, navigate]);
  const handleDeleteFirm = async () => {
    setDeleting(true);
    const { error } = await supabase.from("firms").delete().eq("id", firmId);
    setDeleting(false);
    if (error) {
      toast.error(error.message || "Unable to delete firm");
      return;
    }
    toast.success("Firm deleted");
    qc.invalidateQueries({ queryKey: ["firms-page"] });
    navigate({ to: "/firms", search: { page: 1, limit: DEFAULT_PAGE_SIZE, status: "all", q: "" } });
  };

  const { data: firm } = useQuery({
    queryKey: ["firm", firmId],
    queryFn: async () => (await supabase.from("firms").select("*").eq("id", firmId).single()).data,
  });
  const { data: originatingLead } = useQuery({
    queryKey: ["firm-lead", firmId],
    queryFn: async () => (await supabase.from("leads").select("*").eq("converted_firm_id", firmId).maybeSingle()).data as Record<string, unknown> | null,
  });
  const { data: people = [] } = useQuery({
    queryKey: ["firm-people", firm?.created_by, originatingLead?.converted_by],
    enabled: !!firm,
    queryFn: async () => {
      const ids = Array.from(new Set([firm?.created_by, originatingLead?.converted_by as string | undefined].filter(Boolean))) as string[];
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      return data ?? [];
    },
  });
  const personName = (id: string | null | undefined) => {
    if (!id) return "—";
    const p = people.find(p => p.id === id);
    return p?.full_name || p?.email || "—";
  };
  const { data: contacts = [] } = useQuery({
    queryKey: ["firm-contacts", firmId],
    queryFn: async () =>
      excludeDemoRecords(
        (await supabase.from("firm_contacts").select("*").eq("firm_id", firmId).eq("archived", false)).data,
      ),
  });
  const { data: apps = [] } = useQuery({
    queryKey: ["firm-apps", firmId],
    queryFn: async () =>
      excludeDemoRecords(
        (await supabase
          .from("client_applications")
          .select("*")
          .eq("firm_id", firmId)
          .eq("archived", false)
          .order("created_at", { ascending: false })).data,
      ),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["firm-payments", firmId],
    queryFn: async () => (await supabase.from("payments").select("*").eq("firm_id", firmId).eq("archived", false).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: salesReps = [] } = useQuery({
    queryKey: ["sales-reps"],
    queryFn: async () => {
      const { data: ur } = await supabase.from("user_roles").select("user_id").neq("role", "support" as any);
      const ids = Array.from(new Set((ur ?? []).map(r => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      return profs ?? [];
    },
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["firm-tasks", firmId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("firm_id", firmId).order("due_date", { ascending: true })).data ?? [],
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["firm-notes", firmId],
    queryFn: async () => {
      const { data: ns } = await supabase.from("notes").select("*").eq("related_record_type","firm").eq("related_record_id", firmId).order("created_at",{ascending:false});
      const list = ns ?? [];
      const ids = Array.from(new Set(list.map(n => n.created_by).filter(Boolean))) as string[];
      let nameMap: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
        nameMap = Object.fromEntries((profs ?? []).map(p => [p.id, p.full_name || p.email || "User"]));
      }
      return list.map(n => ({ ...n, author_name: n.created_by ? (nameMap[n.created_by] ?? "User") : "System" }));
    },
  });
  const { data: activity = [] } = useQuery({
    queryKey: ["firm-activity", firmId],
    queryFn: async () => (await supabase.from("activity_logs").select("*").eq("related_record_type","firm").eq("related_record_id", firmId).order("created_at",{ascending:false})).data ?? [],
  });

  const [noteBody, setNoteBody] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [editProfile, setEditProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ state: "", firm_size: "", practice_areas: "", assigned_account_manager: "" });

  const saveProfile = async () => {
    const practice_areas = profileDraft.practice_areas.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("firms").update({
      state: profileDraft.state || null,
      firm_size: profileDraft.firm_size || null,
      practice_areas: practice_areas.length ? practice_areas : null,
      assigned_account_manager: profileDraft.assigned_account_manager || null,
    } as any).eq("id", firmId);
    if (error) return toast.error(error.message);
    setEditProfile(false);
    qc.invalidateQueries({ queryKey: ["firm", firmId] });
    toast.success("Firm profile updated");
  };

  const addNote = async () => {
    if (!noteBody.trim()) return;
    const { error } = await supabase.from("notes").insert({
      related_record_type: "firm", related_record_id: firmId,
      note_type: noteType as any, note_body: noteBody,
      created_by: profile?.id ?? null, created_by_role: roles[0] ?? null,
    });
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert({
      related_record_type: "firm", related_record_id: firmId,
      action_type: "note_added", description: `Note added (${noteType})`,
      performed_by: profile?.id ?? null, performed_by_role: roles[0] ?? null,
    });
    setNoteBody("");
    qc.invalidateQueries({ queryKey: ["firm-notes", firmId] });
    qc.invalidateQueries({ queryKey: ["firm-activity", firmId] });
    toast.success("Note added");
  };

  const updateStatus = async (field: string, value: string) => {
    const { error } = await supabase.from("firms").update({ [field]: value, last_activity_date: new Date().toISOString() } as any).eq("id", firmId);
    if (error) return toast.error(error.message);
    await supabase.from("activity_logs").insert({
      related_record_type: "firm", related_record_id: firmId,
      action_type: `${field}_changed`, description: `${titleize(field)} changed to ${titleize(value)}`,
      performed_by: profile?.id ?? null, performed_by_role: roles[0] ?? null,
    });
    // Auto-create a follow-up task when a demo is marked as no-show.
    if (field === "sales_status" && value === "demo_no_show") {
      const due = new Date(); due.setDate(due.getDate() + 1);
      await supabase.from("tasks").insert({
        title: `Follow up: ${firm?.name} — demo no-show, reschedule`,
        description: "Demo marked as no-show. Reach out to reschedule and move back to Demo Booked once confirmed.",
        firm_id: firmId,
        task_type: "follow_up" as any,
        priority: "high" as any,
        due_date: due.toISOString().slice(0,10),
        assigned_to: firm?.assigned_account_manager ?? profile?.id ?? null,
        created_by: profile?.id ?? null,
      });
      qc.invalidateQueries({ queryKey: ["firm-tasks", firmId] });
      toast.success("Follow-up task created for no-show");
    } else {
      toast.success("Status updated");
    }
    qc.invalidateQueries({ queryKey: ["firm", firmId] });
    qc.invalidateQueries({ queryKey: ["firm-activity", firmId] });
  };

  if (!firm) return <div className="p-6"><Link to="/firms" search={{ page: 1, limit: DEFAULT_PAGE_SIZE, status: "all", q: "" }} className="text-sm text-muted-foreground">← Firms</Link><div className="mt-4">Loading…</div></div>;

  const fundedCount = apps.filter(a => ["funded","paid_to_firm"].includes(a.status)).length;
  const submittedCount = apps.filter(a => !!a.submitted_date).length;
  const offers = apps.filter(a => a.lender_result_status === "offers_returned").length;
  const noOffers = apps.filter(a => a.lender_result_status === "no_offers").length;
  const fundedVol = payments.reduce((s,p)=>s+Number(p.funded_amount||0),0);

  const onboardingLocked = firm.sales_status !== SALES_COMPLETE;
  const salesSteps = buildSalesSteps(firm.sales_status);
  const onboardingSteps = buildOnboardingSteps(firm.onboarding_status, onboardingLocked);

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <Link to="/firms" search={{ page: 1, limit: DEFAULT_PAGE_SIZE, status: "all", q: "" }} className="text-sm text-muted-foreground hover:text-foreground">← Firms</Link>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{firm.name}</h1>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <StatusBadge value={firm.sales_status} tone={salesStatusTone(firm.sales_status)} />
          {!onboardingLocked && <StatusBadge value={firm.onboarding_status} tone={onboardingTone(firm.onboarding_status)} />}
          {canDeleteFirm && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" /> Delete firm
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this firm?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes <span className="font-medium">{firm.name}</span> and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteFirm} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? "Deleting…" : "Delete firm"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-5 space-y-3">
          <CollapsibleFlow title="Sales Flow" steps={salesSteps} defaultOpen={!onboardingLocked ? false : true} />
          <div className="border-t" />
          <CollapsibleFlow title="Onboarding Flow" steps={onboardingSteps} locked={onboardingLocked} lockedMessage="Unlocks after Demo Completed — Signed Up" defaultOpen={!onboardingLocked} />
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
          <TabsTrigger value="apps">Applications ({apps.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card><CardHeader className="flex-row items-center justify-between space-y-0"><CardTitle className="text-base">Firm Profile</CardTitle>
              {canWrite && !editProfile && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setProfileDraft({ state: firm.state ?? "", firm_size: firm.firm_size ?? "", practice_areas: (firm.practice_areas ?? []).join(", "), assigned_account_manager: firm.assigned_account_manager ?? "" }); setEditProfile(true); }}><Pencil className="h-3.5 w-3.5" /></Button>}
              {editProfile && <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditProfile(false)}><X className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveProfile}><Check className="h-3.5 w-3.5" /></Button>
              </div>}
            </CardHeader><CardContent className="text-sm">
              {!editProfile ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
                  <Field label="Client" value={firm.client_name} />
                  <Field label="Location" value={formatLocation(originatingLead?.city as string | undefined, originatingLead?.state as string | undefined)} />
                  <Field label="Main contact" value={firm.main_contact_name} />
                  <Field label="Email" value={firm.email} />
                  <Field label="Phone" value={formatPhone(firm.phone)} />
                  <Field label="Website" value={firm.website} />
                  <Field label="State" value={firm.state} />
                  <Field label="Firm size" value={firm.firm_size} />
                  <Field label="Lead source" value={firm.lead_source ? titleize(firm.lead_source) : null} />
                  <Field label="Practice areas" value={(firm.practice_areas||[]).join(", ")} full />
                  <Field label="Assigned sales rep" value={salesReps.find(r => r.id === firm.assigned_account_manager)?.full_name || salesReps.find(r => r.id === firm.assigned_account_manager)?.email} />
                  <Field label="Created by" value={personName(firm.created_by)} />
                  <Field label="Created" value={fmtDate(firm.created_at)} />
                  <Field label="Last updated" value={fmtDateTime(firm.updated_at)} />
                  <Field label="Last activity" value={fmtDateTime(firm.last_activity_date)} />
                  <Field label="Next follow-up" value={fmtDate(firm.next_follow_up_date)} />
                  <Field label="Reconnect date" value={fmtDate(firm.reconnect_date)} />
                  <Field label="Lost reason" value={firm.lost_reason} full />
                  <Field label="Reconnect notes" value={firm.reconnect_notes} full />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2"><div className="w-28 text-muted-foreground">State</div><Input className="flex-1 h-8" value={profileDraft.state} onChange={e => setProfileDraft(d => ({ ...d, state: e.target.value }))} /></div>
                  <div className="flex items-center gap-2"><div className="w-28 text-muted-foreground">Firm size</div><Input className="flex-1 h-8" placeholder="e.g. 10-50" value={profileDraft.firm_size} onChange={e => setProfileDraft(d => ({ ...d, firm_size: e.target.value }))} /></div>
                  <div className="flex items-center gap-2"><div className="w-28 text-muted-foreground">Practice areas</div><Input className="flex-1 h-8" placeholder="comma separated" value={profileDraft.practice_areas} onChange={e => setProfileDraft(d => ({ ...d, practice_areas: e.target.value }))} /></div>
                  <div className="flex items-center gap-2"><div className="w-28 text-muted-foreground">Lead source</div><div className="flex-1">{titleize(firm.lead_source)}</div></div>
                  <div className="flex items-center gap-2"><div className="w-28 text-muted-foreground">Sales rep</div>
                    <Select value={profileDraft.assigned_account_manager || "none"} onValueChange={v => setProfileDraft(d => ({ ...d, assigned_account_manager: v === "none" ? "" : v }))}>
                      <SelectTrigger className="flex-1 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {salesReps.map(r => <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardContent></Card>

            {originatingLead && (
              <Card><CardHeader><CardTitle className="text-base">Lead Details</CardTitle></CardHeader><CardContent className="text-sm grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Channel" value={titleize(originatingLead.channel as string)} />
                <Field label="Requested amount" value={originatingLead.funding_amount as string | number | undefined} />
                <Field label="Submitted" value={fmtDateTime(originatingLead.created_at as string)} />
                <Field label="External ID" value={originatingLead.external_id as string} />
                <Field label="Converted" value={fmtDateTime(originatingLead.converted_at as string)} />
                <Field label="Converted by" value={personName(originatingLead.converted_by as string)} />
                <Field label="Message" value={originatingLead.message as string} full />
              </CardContent></Card>
            )}

            <Card><CardHeader><CardTitle className="text-base">Payment Setup</CardTitle></CardHeader><CardContent className="text-sm grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Payment status" value={firm.payment_status ? titleize(firm.payment_status) : null} />
              <Field label="Payment processor" value={firm.payment_processor ? titleize(firm.payment_processor) : null} />
              <Field label="Operating account connected" value={firm.operating_account_connected ? titleize(firm.operating_account_connected) : null} />
              <Field label="Trust account connected" value={firm.trust_account_connected ? titleize(firm.trust_account_connected) : null} />
              <Field label="Payment setup updated" value={fmtDateTime(firm.payment_setup_updated_at)} />
              <Field label="Payment setup notes" value={firm.payment_setup_notes} full />
            </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-base">Status Controls</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">
              {(["sales_status","onboarding_status"] as const).map(f => {
                const isLocked = f !== "sales_status" && onboardingLocked;
                return (
                  <div key={f} className="flex items-center gap-2">
                    <div className="w-28 text-muted-foreground capitalize">{titleize(f.replace("_status",""))}</div>
                    <Select disabled={!canWrite || isLocked} value={firm[f]} onValueChange={v => updateStatus(f, v)}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder={isLocked ? "Locked until sales complete" : undefined} /></SelectTrigger>
                      <SelectContent>
                        {(f === "sales_status" ? SALES_OPTIONS as readonly string[] : ONBOARDING_FLOW as readonly string[]
                        ).map(o => <SelectItem key={o} value={o}>{titleize(o)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </CardContent></Card>

            <Card><CardHeader><CardTitle className="text-base">Application Metrics</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div><div className="text-muted-foreground text-xs">Total apps</div><div className="font-semibold">{apps.length}</div></div>
              <div><div className="text-muted-foreground text-xs">Submitted</div><div className="font-semibold">{submittedCount}</div></div>
              <div><div className="text-muted-foreground text-xs">Offers returned</div><div className="font-semibold">{offers}</div></div>
              <div><div className="text-muted-foreground text-xs">No offers</div><div className="font-semibold">{noOffers}</div></div>
              <div><div className="text-muted-foreground text-xs">Funded</div><div className="font-semibold">{fundedCount}</div></div>
              <div><div className="text-muted-foreground text-xs">Funded volume</div><div className="font-semibold">{fmtMoney(fundedVol)}</div></div>
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsSection
            firmId={firmId}
            firm={firm}
            contacts={contacts}
            canWrite={canWrite}
            onChanged={() => qc.invalidateQueries({ queryKey: ["firm-contacts", firmId] })}
          />
        </TabsContent>

        <TabsContent value="apps">
          <Card><Table><TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Funding</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader>
            <TableBody>{apps.map(a => <TableRow key={a.id}><TableCell><Link to="/applications/$applicationId" params={{ applicationId: a.id }} className="hover:text-primary">{a.client_name}</Link></TableCell><TableCell>{fmtMoney(a.amount_requested)}</TableCell><TableCell><StatusBadge value={a.status} tone={applicationTone(a.status)} /></TableCell><TableCell><StatusBadge value={a.funding_status} tone={paymentTone(a.funding_status)} /></TableCell><TableCell>{fmtDate(a.submitted_date)}</TableCell></TableRow>)}
              {!apps.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No applications.</TableCell></TableRow>}
            </TableBody></Table></Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-3">
          <div className="flex justify-end">
            <NewFirmTaskDialog
              firmId={firmId}
              firmName={firm.name}
              defaultAssignee={profile?.id ?? null}
              salesReps={salesReps}
              onCreated={() => { qc.invalidateQueries({ queryKey: ["firm-tasks", firmId] }); qc.invalidateQueries({ queryKey: ["dashboard-tasks"] }); }}
              disabled={!canWrite}
            />
          </div>
          <Card><Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Due</TableHead><TableHead>Priority</TableHead><TableHead>Assigned to</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>{tasks.map(t => {
                const assignee = salesReps.find(r => r.id === t.assigned_to);
                const assigneeLabel = t.assigned_to
                  ? (t.assigned_to === profile?.id ? "Me" : (assignee?.full_name || assignee?.email || "—"))
                  : "Unassigned";
                return (
                  <TableRow key={t.id}>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>{fmtDate(t.due_date)}</TableCell>
                    <TableCell>{titleize(t.priority)}</TableCell>
                    <TableCell>{assigneeLabel}</TableCell>
                    <TableCell><StatusBadge value={t.status} tone={taskTone(t.status)} /></TableCell>
                  </TableRow>
                );
              })}
              {!tasks.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No tasks yet. Create one above.</TableCell></TableRow>}
            </TableBody></Table></Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-3">
          <Card><CardContent className="p-3 space-y-2">
            <div className="flex gap-2">
              <Select value={noteType} onValueChange={setNoteType}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>{NOTE_TYPES.map(n => <SelectItem key={n} value={n}>{titleize(n)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Textarea placeholder="Add a note…" value={noteBody} onChange={e=>setNoteBody(e.target.value)} disabled={!canWrite} />
            <div className="flex justify-end"><Button onClick={addNote} disabled={!canWrite || !noteBody.trim()}>Add note</Button></div>
          </CardContent></Card>
          {notes.map(n => (
            <Card key={n.id}><CardContent className="p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-2"><StatusBadge value={n.note_type} tone="info" /> <span className="font-medium text-foreground">{n.author_name}</span>{n.created_by_role && <span>· {ROLE_LABEL[n.created_by_role]}</span>}</span>
                <span>{fmtDateTime(n.created_at)}{n.edited && ` · edited ${fmtDateTime(n.updated_at)}`}</span>
              </div>
              <div className="text-sm whitespace-pre-wrap">{n.note_body}</div>
            </CardContent></Card>
          ))}
          {!notes.length && <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const CONTACT_ROLES = ["attorney","paralegal","admin_assistant","billing","other"] as const;

function ContactsSection({ firmId, firm, contacts, canWrite, onChanged }: {
  firmId: string;
  firm: any;
  contacts: any[];
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", role: "attorney", email: "", phone: "", notes: "" });

  // Synthesize a "main" contact row from the firm record itself when not yet
  // saved as a firm_contacts row, so the originally-entered contact is visible.
  const hasMainAsContact = contacts.some(c =>
    (firm.main_contact_name && c.name?.toLowerCase() === firm.main_contact_name.toLowerCase()) ||
    (firm.email && c.email?.toLowerCase() === firm.email?.toLowerCase())
  );
  const mainSynthetic = !hasMainAsContact && (firm.main_contact_name || firm.email || firm.phone)
    ? { id: "__main__", name: firm.main_contact_name || "—", role: "main_contact", email: firm.email, phone: firm.phone, notes: null, isSynthetic: true }
    : null;
  const rows = mainSynthetic ? [mainSynthetic, ...contacts] : contacts;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("firm_contacts").insert({
      firm_id: firmId,
      name: form.name.trim(),
      role: form.role as any,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      notes: form.notes.trim() || null,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Contact added");
    setForm({ name: "", role: "attorney", email: "", phone: "", notes: "" });
    setOpen(false);
    onChanged();
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Use the <span className="font-medium text-foreground">Notes</span> column to add helpful info
        about each contact — name pronunciation, known availability or best times to call, preferences,
        anything useful. Click the pencil on any note cell to edit it inline.
      </p>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!canWrite}><Plus className="h-4 w-4 mr-1" />Add Contact</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></div>
              <div><Label>Role</Label>
                <Select value={form.role} onValueChange={v=>setForm({...form,role:v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CONTACT_ROLES.map(r=><SelectItem key={r} value={r}>{titleize(r)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} /></div>
              <div><Label>Notes</Label><Textarea rows={2} placeholder="Add helpful info, known availability times, name pronunciation, etc." value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              <DialogFooter><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Contact"}</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card><Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead className="w-[28%]">Notes</TableHead></TableRow></TableHeader>
        <TableBody>
          {rows.map(c => (
            <TableRow key={c.id}>
              <TableCell>{c.name}{(c as any).isSynthetic && <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">Main</span>}</TableCell>
              <TableCell>{titleize(c.role)}</TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell>{formatPhone(c.phone)}</TableCell>
              <TableCell>
                <ContactNoteEditor
                  contactId={(c as any).isSynthetic ? null : c.id}
                  value={c.notes}
                  canWrite={canWrite}
                  onSaved={onChanged}
                  firmId={firmId}
                  synthetic={(c as any).isSynthetic ? { name: c.name, email: c.email ?? null, phone: c.phone ?? null } : undefined}
                />
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No contacts.</TableCell></TableRow>}
        </TableBody>
      </Table></Card>
    </div>
  );
}

function ContactNoteEditor({ contactId, value, canWrite, onSaved, firmId, synthetic }: {
  contactId: string | null;
  value: string | null;
  canWrite: boolean;
  onSaved: () => void;
  firmId: string;
  synthetic?: { name: string; email: string | null; phone: string | null };
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const trimmed = draft.trim() || null;
    let error;
    if (contactId === null && synthetic) {
      ({ error } = await supabase.from("firm_contacts").insert({
        firm_id: firmId,
        name: synthetic.name,
        role: "other" as any,
        email: synthetic.email,
        phone: synthetic.phone,
        notes: trimmed,
      } as any));
    } else if (contactId) {
      ({ error } = await supabase.from("firm_contacts").update({ notes: trimmed } as any).eq("id", contactId));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    setEditing(false);
    onSaved();
  };

  if (editing) {
    return (
      <div className="space-y-1">
        <Textarea rows={2} value={draft} onChange={e=>setDraft(e.target.value)} autoFocus className="text-sm" />
        <div className="flex gap-1">
          <Button size="sm" onClick={save} disabled={saving}><Check className="h-3 w-3" /></Button>
          <Button size="sm" variant="ghost" onClick={()=>{setDraft(value ?? "");setEditing(false);}}><X className="h-3 w-3" /></Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={()=>canWrite && setEditing(true)}
      disabled={!canWrite}
      className={cn(
        "group flex items-start gap-2 text-left text-sm w-full rounded px-1.5 py-1 -mx-1.5 -my-1 transition-colors",
        canWrite && "hover:bg-muted cursor-pointer"
      )}
    >
      <span className={cn("flex-1 whitespace-pre-wrap", !value && "text-muted-foreground italic")}>
        {value || (canWrite ? "Click to add a note…" : "—")}
      </span>
      {canWrite && <Pencil className="h-3 w-3 mt-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />}
    </button>
  );
}

function NewFirmTaskDialog({ firmId, firmName, defaultAssignee, salesReps, onCreated, disabled }: {
  firmId: string;
  firmName: string;
  defaultAssignee: string | null;
  salesReps: Array<{ id: string; full_name: string | null; email: string | null }>;
  onCreated: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState<string>(defaultAssignee ?? "");
  const [saving, setSaving] = useState(false);
  const { hasRole } = useAuth();
  const canAssign = hasRole(["super_admin", "admin", "sales_team_lead", "operations_team_lead"]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      firm_id: firmId,
      due_date: dueDate || null,
      priority: priority as any,
      assigned_to: assignee || null,
      created_by: defaultAssignee,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Task added to ${firmName}`);
    setTitle(""); setDueDate(""); setPriority("medium"); setAssignee(defaultAssignee ?? "");
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}><Plus className="h-3.5 w-3.5 mr-1" />New Task</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Task for {firmName}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={e=>setTitle(e.target.value)} required autoFocus /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label>Due date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className={cn("mt-2 justify-start text-left font-normal", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(new Date(dueDate + "T00:00:00"), "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={dueDate ? new Date(dueDate + "T00:00:00") : undefined} onSelect={(d) => setDueDate(d ? format(d, "yyyy-MM-dd") : "")} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["low","medium","high","urgent"].map(p => <SelectItem key={p} value={p}>{titleize(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {canAssign && (
            <div>
              <Label>Assign to</Label>
              <Select value={assignee || "__unassigned__"} onValueChange={v => setAssignee(v === "__unassigned__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Select assignee" /></SelectTrigger>
                <SelectContent>
                  {defaultAssignee && <SelectItem value={defaultAssignee}>Me</SelectItem>}
                  {salesReps.filter(r => r.id !== defaultAssignee).map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name || r.email || "User"}</SelectItem>
                  ))}
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={saving || !title.trim()}>{saving ? "Creating…" : "Create task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}