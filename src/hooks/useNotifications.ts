import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  lead_id: string | null;
  read: boolean;
  created_at: string;
};

// ── Queries ────────────────────────────────────────────────────────────────

export function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications-unread-count"],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

export function useRecentNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications-recent"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });
}

export function useNotificationsPage(page: number, limit: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notifications-list", page, limit],
    enabled: !!user,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      const { data, count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rows = (data ?? []) as Notification[];
      const total = count ?? rows.length;
      return { rows, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
    },
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
  qc.invalidateQueries({ queryKey: ["notifications-recent"] });
  qc.invalidateQueries({ queryKey: ["notifications-list"] });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Realtime subscription ──────────────────────────────────────────────────
// Mount once inside the authenticated layout to keep the badge + dropdown fresh.

export function useNotificationsRealtime() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-user-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => invalidateAll(qc),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);
}
