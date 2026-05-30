// src/hooks/useUserPlants.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";

export interface UserPlant {
  id: string;
  user_id: string;
  name: string;
  type: string;
  plant_date: string;
  location: string | null;
  soil_condition: string;
  notes: string | null;
  status: string;
  image_url: string | null;
  created_at: string;
}

export interface UserPlantWithAge extends UserPlant {
  age_days: number;
}

export function usePlants() {
  return useQuery({
    queryKey: ["user-plants"],
    queryFn: async (): Promise<UserPlantWithAge[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_plants")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        soil_condition: p.soil_condition ?? "Normal",
        age_days: differenceInDays(new Date(), parseISO(p.plant_date)),
      }));
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddPlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plant: {
      name: string;
      type: string;
      plant_date: string;
      location?: string;
      soil_condition: string;
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Tidak terautentikasi");
      const { error } = await supabase.from("user_plants").insert({
        ...plant,
        user_id: user.id,
        status: "Aktif",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-plants"] });
      toast.success("Tanaman berhasil ditambahkan!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePlant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_plants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-plants"] });
      toast.success("Tanaman dihapus.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdatePlantStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("user_plants").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-plants"] }),
  });
}
