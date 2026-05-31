// src/hooks/useProfile.ts
// Centralized profile hook — used by AppShell, community, etc.
// Listens to "profile-updated" event emitted after save/avatar upload in profile page.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  location: string | null;
  phone: string | null;
  farmer_type: string | null;
  bio: string | null;
  notification_prefs: Record<string, boolean> | null;
}

export function useProfile() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["my-profile"],
    queryFn: async (): Promise<Profile | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, location, phone, farmer_type, bio, notification_prefs")
        .eq("id", user.id)
        .maybeSingle();
      return data ?? null;
    },
    staleTime: 2 * 60 * 1000,
  });

  // Refetch whenever profile is saved from the settings page
  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ["my-profile"] });
    window.addEventListener("profile-updated", handler);
    return () => window.removeEventListener("profile-updated", handler);
  }, [qc]);

  return query;
}