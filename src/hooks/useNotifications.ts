import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  is_read: boolean;
  created_at: string;
}

// Helper untuk parse body JSON
function parseBody(body: string | null): any {
  if (!body) return { raw: null };
  try {
    return JSON.parse(body);
  } catch {
    return { raw: body };
  }
}

// Ekstrak POST_ID dari body notifikasi (support JSON dan plain text)
function extractPostId(body: string | null): string | null {
  if (!body) return null;
  
  const parsed = parseBody(body);
  
  // Coba dari JSON
  if (parsed.post_id) {
    return parsed.post_id;
  }
  
  // Fallback ke regex untuk plain text
  const m = body.match(/POST_ID:([a-f0-9-]+)/);
  return m ? m[1] : null;
}

// Ekstrak comment_id jika ada
function extractCommentId(body: string | null): string | null {
  if (!body) return null;
  const parsed = parseBody(body);
  return parsed.comment_id || null;
}

export function useNotifications() {
  const qc = useQueryClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
        community:      "community",
        community_like: "community",
        diagnosis:      "diagnosis",
        weather:        "weather",
        ai:             "ai",
        report:         "_always",
        warning:        "_always",
        success:        "_always",
        info:           "_always",
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
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      if (channelRef.current) return;

      const channelName = `notifications-realtime-${user.id}`;

      supabase.getChannels().forEach((ch) => {
        if (ch.topic === `realtime:${channelName}`) {
          supabase.removeChannel(ch);
        }
      });

      const channel = supabase
        .channel(channelName)
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

      channelRef.current = channel;
    });

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

// Format body untuk tampilan web
export function formatNotificationBody(body: string | null): string {
  if (!body) return "";
  
  const parsed = parseBody(body);
  
  // Untuk notifikasi warning (postingan dilarang dari admin)
  if (parsed.message && (parsed.action === 'approved' || parsed.reason)) {
    return parsed.message;
  }
  
  // Untuk notifikasi komentar
  if (parsed.commenter_name && parsed.comment_content) {
    return `${parsed.commenter_name}: "${parsed.comment_content}"`;
  }
  
  // Untuk notifikasi laporan ditolak
  if (parsed.action === 'rejected' && parsed.message) {
    return parsed.message;
  }
  
  // Untuk notifikasi dengan raw text
  if (parsed.raw) {
    return parsed.raw.replace(/POST_ID:[a-f0-9-]+\n?/, "").trim();
  }
  
  // Fallback: tampilkan body apa adanya
  return body.length > 100 ? body.substring(0, 100) + '...' : body;
}

// Navigasi berdasarkan tipe notifikasi
export function getNotificationLink(notification: Notification): string {
  const type = notification.type;
  const postId = extractPostId(notification.body);
  const commentId = extractCommentId(notification.body);

  switch (type) {
    case "community":
    case "community_like":
      if (postId) {
        return commentId ? `/community?post=${postId}&comment=${commentId}` : `/community?post=${postId}`;
      }
      return "/community";
    case "warning":
    case "success":
    case "report":
      if (postId) return `/community?post=${postId}`;
      return "/admin";
    case "diagnosis":
      return "/plant-doctor";
    case "weather":
      return "/weather";
    case "ai":
      return "/assistant";
    default:
      return "/dashboard";
  }
}

// Get icon untuk notifikasi
export function getNotificationIcon(type: string | null): string {
  const icons: Record<string, string> = {
    warning: "⚠️",
    success: "✅",
    community: "💬",
    community_like: "❤️",
    diagnosis: "🌿",
    weather: "⛅",
    info: "ℹ️",
    report: "📋",
  };
  return icons[type ?? "info"] ?? "🔔";
}

// Get warna untuk notifikasi
export function getNotificationColor(type: string | null): string {
  const colors: Record<string, string> = {
    warning: "text-orange-600 bg-orange-50 border-orange-200",
    success: "text-green-600 bg-green-50 border-green-200",
    community: "text-blue-600 bg-blue-50 border-blue-200",
    community_like: "text-red-600 bg-red-50 border-red-200",
    info: "text-gray-600 bg-gray-50 border-gray-200",
  };
  return colors[type ?? "info"] ?? "text-gray-600 bg-gray-50";
}