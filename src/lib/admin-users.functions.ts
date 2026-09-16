import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ROLES = ["super_admin", "admin", "sales_team_lead", "sales", "operations_team_lead", "operations", "support"] as const;

export const createTeamUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(128),
      full_name: z.string().min(1).max(120),
      role: z.enum(ROLES),
      birthday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller is admin/super_admin via RLS-respecting client
    const { data: callerRoles, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleErr) throw new Error(roleErr.message);
    const isAdmin = (callerRoles ?? []).some(
      (r: { role: string }) => r.role === "admin" || r.role === "super_admin",
    );
    if (!isAdmin) throw new Error("Only admins can create users");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (createErr) throw new Error(createErr.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("User creation returned no id");

    // Trigger seeds 'support' role by default; replace with chosen role.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: data.role });
    if (insErr) throw new Error(insErr.message);

    if (data.birthday) {
      await supabaseAdmin.from("profiles").update({ birthday: data.birthday }).eq("id", newId);
    }

    return { id: newId, email: data.email };
  });
