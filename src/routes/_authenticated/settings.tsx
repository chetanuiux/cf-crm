import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABEL, fmtDateTime, titleize } from "@/lib/labels";
import {
  createTeamUserViaEdge,
  deleteTeamUserViaEdge,
  updateTeamUserViaEdge,
  type TeamRole,
} from "@/lib/admin-users";
import { toast } from "sonner";
import { excludeDemoRecords, excludeDemoUsers } from "@/lib/demo-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/settings")({ component: SettingsPage });

const ROLES = ["super_admin","admin","sales_team_lead","sales","operations_team_lead","operations","support"];

function SettingsPage() {
  const { user, profile, isAdmin, canManageUsers, isSuperAdmin } = useAuth();
  const qc = useQueryClient();

  // Profile state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Admin state
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPasswordUser, setNewPasswordUser] = useState("");
  const [newRole, setNewRole] = useState<string>("support");
  const [newBirthday, setNewBirthday] = useState("");
  const [creating, setCreating] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<string>("support");
  const [editBirthday, setEditBirthday] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    supabase.from("profiles").select("full_name, avatar_url, birthday").eq("id", user.id).maybeSingle().then(({ data }) => {
      setFullName(data?.full_name ?? profile?.full_name ?? "");
      setAvatarUrl(data?.avatar_url ?? null);
      setBirthday(data?.birthday ?? "");
    });
  }, [user, profile]);

  const onSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error: pErr } = await supabase.from("profiles").update({
      full_name: fullName.trim() || null,
      birthday: birthday || null,
    }).eq("id", user.id);
    if (pErr) { setSavingProfile(false); return toast.error(pErr.message); }
    if (email && email !== user.email) {
      const { error: eErr } = await supabase.auth.updateUser({ email });
      if (eErr) { setSavingProfile(false); return toast.error(eErr.message); }
      toast.success("Profile saved. Check your inbox to confirm the new email.");
    } else {
      toast.success("Profile saved");
    }
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    setSavingProfile(false);
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) return toast.error("Please enter your current password");
    if (newPassword.length < 8) return toast.error("New password must be at least 8 characters");
    if (newPassword === oldPassword) return toast.error("New password must be different from the old password");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    setSavingPassword(true);
    // Verify old password by signing in
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: user?.email ?? "", password: oldPassword });
    if (verifyErr) {
      setSavingPassword(false);
      return toast.error("Current password is incorrect");
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setOldPassword(""); setNewPassword(""); setConfirmPassword("");
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = pub.publicUrl;
    const { error: dbErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    setAvatarUrl(url);
    toast.success("Profile picture updated");
  };

  const initials = (fullName || email || "?").split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase();

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    enabled: canManageUsers,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("*"),
      ]);
      return excludeDemoUsers(
        (profiles ?? []).map((p) => ({
          ...p,
          roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role),
        })),
      );
    },
  });

  const { data: audit = [] } = useQuery({
    queryKey: ["audit"],
    enabled: canManageUsers,
    queryFn: async () =>
      excludeDemoRecords(
        (await supabase
          .from("activity_logs")
          .select("*, profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(100)).data,
      ),
  });

  const { data: deletionLog = [] } = useQuery({
    queryKey: ["deletion-log"],
    enabled: isSuperAdmin,
    queryFn: async () =>
      excludeDemoRecords(
        (await supabase
          .from("activity_logs")
          .select("*, profiles(full_name, email)")
          .in("action_type", ["lead_dismissed", "firm_archived", "firm_deleted"])
          .order("created_at", { ascending: false })
          .limit(100)).data,
      ),
  });

  const setRole = async (userId: string, role: string) => {
    try {
      await updateTeamUserViaEdge({ user_id: userId, role: role as TeamRole });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update role");
    }
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditName(u.full_name ?? "");
    setEditEmail(u.email ?? "");
    setEditPassword("");
    setEditRole(u.roles?.[0] ?? "support");
    setEditBirthday(u.birthday ?? "");
  };

  const onSaveEdit = async () => {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      await updateTeamUserViaEdge({
        user_id: editUser.id,
        full_name: editName.trim() || undefined,
        email: editEmail.trim() || undefined,
        password: editPassword.trim() || undefined,
        role: editRole as TeamRole,
        birthday: editBirthday || undefined,
      });
      toast.success("User updated");
      setEditUser(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteUser) return;
    setDeleting(true);
    try {
      await deleteTeamUserViaEdge(deleteUser.id);
      toast.success("User deleted");
      setDeleteUser(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  const onCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createTeamUserViaEdge({
        full_name: newName,
        email: newEmail,
        password: newPasswordUser,
        role: newRole as TeamRole,
        birthday: newBirthday || undefined,
      });
      toast.success("User created");
      setNewName(""); setNewEmail(""); setNewPasswordUser(""); setNewRole("support"); setNewBirthday("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const defaultTab = isAdmin ? "profile" : "profile";

  return (
    <div className="p-6 space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and team settings.</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          {canManageUsers && (
            <>
              <TabsTrigger value="users">Users & Roles</TabsTrigger>
              <TabsTrigger value="audit">Audit Log</TabsTrigger>
            </>
          )}
          {isSuperAdmin && <TabsTrigger value="deletion-log">Deletion Log</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile" className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-20 w-20">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile picture" />}
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <Label htmlFor="avatar" className="cursor-pointer inline-block">
                    <span className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent px-3 py-2">
                      {uploading ? "Uploading…" : "Upload picture"}
                    </span>
                    <Input id="avatar" type="file" accept="image/*" className="hidden" onChange={onAvatarChange} disabled={uploading} />
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">PNG or JPG, up to 5MB.</p>
                </div>
              </div>
              <form onSubmit={onSaveProfile} className="space-y-3">
                <div><Label>Full name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} maxLength={100} /></div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={255} />
                  <p className="text-xs text-muted-foreground mt-1">Changing your email requires confirmation from the new address.</p>
                </div>
                <div className="flex justify-end"><Button type="submit" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save profile"}</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Change password</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={onChangePassword} className="space-y-3">
                <div><Label>Old password</Label><Input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} required /></div>
                <div><Label>New password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required /></div>
                <div><Label>Confirm new password</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required /></div>
                <div className="flex justify-end"><Button type="submit" disabled={savingPassword}>{savingPassword ? "Updating…" : "Update password"}</Button></div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {canManageUsers && (
          <>
            <TabsContent value="users" className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Create team user</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={onCreateUser} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                    <div><Label>Full name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} required /></div>
                    <div><Label>Email</Label><Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required /></div>
                    <div><Label>Temp password</Label><Input type="text" value={newPasswordUser} onChange={e => setNewPasswordUser(e.target.value)} required minLength={8} /></div>
                    <div>
                      <Label>Role</Label>
                      <Select value={newRole} onValueChange={setNewRole}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Birthday <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label><Input type="date" value={newBirthday} onChange={e => setNewBirthday(e.target.value)} /></div>
                    <Button type="submit" disabled={creating}>{creating ? "Creating…" : "Create user"}</Button>
                  </form>
                </CardContent>
              </Card>

              <Card><Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Current Role</TableHead><TableHead>Change Role</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                <TableBody>{users.map((u: any) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell className="text-sm">{u.roles.map((r: string) => ROLE_LABEL[r]).join(", ") || "—"}</TableCell>
                    <TableCell>
                      <Select onValueChange={v => setRole(u.id, v)}>
                        <SelectTrigger className="w-48"><SelectValue placeholder="Set role…" /></SelectTrigger>
                        <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDateTime(u.created_at)}</TableCell>
                    <TableCell>
                      {canManageUsers ? (
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(u)}>Update</Button>
                          <Button type="button" variant="destructive" size="sm" disabled={u.id === user?.id} onClick={() => setDeleteUser(u)}>Delete</Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table></Card>

              <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
                <DialogContent>
                  <DialogHeader><DialogTitle>Update user</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Full name</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
                    <div><Label>Email</Label><Input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} /></div>
                    <div><Label>New password <span className="text-xs text-muted-foreground">(optional)</span></Label><Input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="Leave blank to keep" /></div>
                    <div><Label>Role</Label><Select value={editRole} onValueChange={setEditRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Birthday</Label><Input type="date" value={editBirthday} onChange={e => setEditBirthday(e.target.value)} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                    <Button onClick={onSaveEdit} disabled={savingEdit}>{savingEdit ? "Saving…" : "Save"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {deleteUser?.full_name || deleteUser?.email}?</AlertDialogTitle>
                    <AlertDialogDescription>This permanently removes the account.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onConfirmDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </TabsContent>

            <TabsContent value="audit">
              <Card><Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Action</TableHead><TableHead>Record</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
                <TableBody>{audit.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-sm">{fmtDateTime(a.created_at)}</TableCell>
                    <TableCell>{a.description}<div className="text-xs text-muted-foreground">{titleize(a.action_type)}</div></TableCell>
                    <TableCell className="text-sm">{titleize(a.related_record_type)}</TableCell>
                    <TableCell className="text-sm">{a.profiles?.full_name || "—"}</TableCell>
                  </TableRow>
                ))}
                </TableBody>
              </Table></Card>
            </TabsContent>
          </>
        )}

        {isSuperAdmin && (
          <TabsContent value="deletion-log">
            <Card><Table>
              <TableHeader><TableRow>
                <TableHead>When</TableHead>
                <TableHead>Record type</TableHead>
                <TableHead>Record name</TableHead>
                <TableHead>Deleted by</TableHead>
                <TableHead>How</TableHead>
              </TableRow></TableHeader>
              <TableBody>{deletionLog.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="text-sm">{fmtDateTime(a.created_at)}</TableCell>
                  <TableCell className="text-sm">{titleize(a.related_record_type)}</TableCell>
                  <TableCell className="text-sm">{a.metadata?.lead_name || a.metadata?.firm_name || "—"}</TableCell>
                  <TableCell className="text-sm">{a.profiles?.full_name || a.profiles?.email || "—"}</TableCell>
                  <TableCell className="text-sm">
                    {a.action_type === "lead_dismissed" && "Dismissed"}
                    {a.action_type === "firm_archived" && "Archived"}
                    {a.action_type === "firm_deleted" && "Deleted"}
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table></Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
