// src/hooks/useNotifications.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<Notification[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    staleTime: 60 * 1000,
    refetchInterval: 2 * 60 * 1000, // poll setiap 2 menit
  });

  const unreadCount = (query.data ?? []).filter((n) => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("notifications").update({ is_read: true }).eq("id", id).eq("user_id", user.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return { notifications: query.data ?? [], unreadCount, markRead, markAllRead, loading: query.isLoading };
}

// Helper untuk insert notifikasi (dipakai di berbagai tempat)
export async function pushNotification(userId: string, notification: {
  title: string;
  body?: string;
  type?: "info" | "warning" | "success" | "community" | "diagnosis" | "weather";
}) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title: notification.title,
    body: notification.body ?? null,
    type: notification.type ?? "info",
  });
}
