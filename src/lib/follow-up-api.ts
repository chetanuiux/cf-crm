import { supabase } from "@/integrations/supabase/client";

export async function completeFollowUp(id: string) {
  const { error } = await supabase.rpc("complete_follow_up", { _id: id });
  if (error) throw error;
}

export async function setPromisedFollowUp(firmId: string, at: string | null) {
  const { error } = await supabase.rpc("set_promised_follow_up", {
    p_firm_id: firmId,
    p_at: at,
  });
  if (error) throw error;
}

export async function createManualFollowUp(params: {
  kind: "sales" | "application";
  firmId?: string | null;
  sessionId?: string | null;
  dueAt: string;
  title?: string;
  message?: string;
}) {
  const { data, error } = await supabase.rpc("create_manual_follow_up", {
    p_kind: params.kind,
    p_firm_id: params.firmId ?? null,
    p_session: params.sessionId ?? null,
    p_due_at: params.dueAt,
    p_title: params.title ?? null,
    p_message: params.message ?? null,
  });
  if (error) throw error;
  return data as string;
}
