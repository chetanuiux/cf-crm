import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const Route = createFileRoute("/_authenticated/signup-lawfirm")({ component: SignupLawfirmPage });

function SignupLawfirmPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", main_contact_name: "", email: "", phone: "", website: "",
    state: "", firm_size: "", practice_areas: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Firm name is required"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("firms").insert({
      name: form.name.trim(),
      main_contact_name: form.main_contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      website: form.website || null,
      state: form.state || null,
      firm_size: form.firm_size || null,
      practice_areas: form.practice_areas ? form.practice_areas.split(",").map(s => s.trim()).filter(Boolean) : null,
      created_by: user?.id ?? null,
      assigned_account_manager: user?.id ?? null,
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Law firm created");
    navigate({ to: "/firms/$firmId", params: { firmId: data.id } });
  };

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Firm Sign Up</h1>
        <p className="text-sm text-muted-foreground">Onboard a new law firm to CaseFunders.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Firm details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><Label>Firm name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} required /></div>
            <div><Label>Main contact name</Label><Input value={form.main_contact_name} onChange={e => set("main_contact_name", e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => set("email", e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => set("phone", e.target.value)} /></div>
            <div><Label>Website</Label><Input value={form.website} onChange={e => set("website", e.target.value)} /></div>
            <div><Label>State</Label><Input value={form.state} onChange={e => set("state", e.target.value)} placeholder="e.g. CA" /></div>
            <div><Label>Firm size</Label><Input value={form.firm_size} onChange={e => set("firm_size", e.target.value)} placeholder="e.g. 1-10" /></div>
            <div className="md:col-span-2"><Label>Practice areas</Label><Textarea value={form.practice_areas} onChange={e => set("practice_areas", e.target.value)} placeholder="Comma-separated (e.g. Personal Injury, Family Law)" /></div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/firms", search: { page: 1, limit: DEFAULT_PAGE_SIZE, status: "all", q: "" } })}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create firm"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
