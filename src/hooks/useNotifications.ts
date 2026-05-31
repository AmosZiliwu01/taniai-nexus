import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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

      const [notifRes, prefRes] = await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("profiles")
          .select("notification_prefs")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      const allNotifs: Notification[] = notifRes.data ?? [];
      const prefs = prefRes.data?.notification_prefs as Record<string, boolean> | null;

      if (!prefs) return allNotifs;

      const typeToKey: Record<string, string> = {
        community: "community",
        diagnosis: "diagnosis",
        weather: "weather",
        ai: "ai",
        warning: "_always",
        success: "_always",
        info: "_always",
      };

      return allNotifs.filter((n) => {
        const key = typeToKey[n.type ?? "info"] ?? "_always";
        if (key === "_always") return true;
        return prefs[key] !== false;
      });
    },
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
  });

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel("notifications-realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ["notifications"] });
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const unreadCount = (query.data ?? []).filter((n) => !n.is_read).length;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", id)
        .eq("user_id", user.id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return {
    notifications: query.data ?? [],
    unreadCount,
    markRead,
    markAllRead,
    loading: query.isLoading,
  };
}

export async function pushNotification(
  userId: string,
  notification: {
    title: string;
    body?: string;
    type?: "info" | "warning" | "success" | "community" | "diagnosis" | "weather" | "ai";
  }
) {
  await supabase.from("notifications").insert({
    user_id: userId,
    title: notification.title,
    body: notification.body ?? null,
    type: notification.type ?? "info",
  });
}

// Fungsi untuk menentukan rute navigasi berdasarkan notifikasi (dengan ekstrak POST_ID)
export function getNotificationLink(notification: Notification): string {
  const type = notification.type;
  const body = notification.body || "";

  // Cek apakah ada POST_ID di body (format: POST_ID:uuid)
  const postIdMatch = body.match(/POST_ID:([a-f0-9-]+)/);
  const postId = postIdMatch ? postIdMatch[1] : null;

  switch (type) {
    case "community":
      // Jika ada POST_ID, langsung ke postingan tersebut di halaman komunitas
      return postId ? `/community?post=${postId}` : "/community";
    case "warning":
    case "success":
      // Jika ada POST_ID (misal dari laporan/peringatan postingan), arahkan ke komunitas
      if (postId) return `/community?post=${postId}`;
      return "/dashboard";
    case "diagnosis":
      return "/plant-doctor";
    case "weather":
      return "/weather";
    case "ai":
      return "/assistant";
    case "info":
    default:
      return "/dashboard";
  }
}