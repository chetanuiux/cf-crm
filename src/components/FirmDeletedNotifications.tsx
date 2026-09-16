import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/labels";
import { AlertTriangle } from "lucide-react";

type LogRow = {
  id: string;
  description: string;
  created_at: string;
  performed_by: string | null;
  metadata: any;
  profiles?: { full_name: string | null } | null;
};

export function FirmDeletedNotifications({ userId }: { userId: string }) {
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["firm-deleted-notifications", userId],
    queryFn: async (): Promise<LogRow[]> => {
      const { data: dismissed } = await supabase
        .from("notification_dismissals")
        .select("activity_log_id")
        .eq("user_id", userId);
      const dismissedIds = (dismissed ?? []).map(d => d.activity_log_id);
      let q = supabase
        .from("activity_logs")
        .select("id, description, created_at, performed_by, metadata, profiles:performed_by(full_name)")
        .eq("action_type", "firm_deleted")
        .order("created_at", { ascending: false })
        .limit(50);
      if (dismissedIds.length) q = q.not("id", "in", `(${dismissedIds.join(",")})`);
      const { data } = await q;
      return (data ?? []) as any;
    },
    refetchInterval: 30000,
  });

  const top = notifications[0];
  if (!top) return null;

  const dismiss = async () => {
    await supabase.from("notification_dismissals").insert({ user_id: userId, activity_log_id: top.id });
    qc.invalidateQueries({ queryKey: ["firm-deleted-notifications", userId] });
  };

  const actor = top.profiles?.full_name ?? "Someone";
  const firmName = top.metadata?.firm_name ?? "a firm";

  return (
    <Dialog open onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Firm deleted
          </DialogTitle>
          <DialogDescription className="pt-2 space-y-1">
            <div><span className="font-medium text-foreground">{actor}</span> deleted <span className="font-medium text-foreground">{firmName}</span>.</div>
            <div className="text-xs">{fmtDateTime(top.created_at)}</div>
            {notifications.length > 1 && (
              <div className="text-xs pt-2">{notifications.length - 1} more notification{notifications.length - 1 === 1 ? "" : "s"} after this one.</div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={dismiss}>Dismiss</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
