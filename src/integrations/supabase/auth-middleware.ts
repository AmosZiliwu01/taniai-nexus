// src/integrations/supabase/auth-middleware.ts
import { supabase } from "./client";

export async function requireSupabaseAuth() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Unauthorized");
  return data.user;
}

export async function getSupabaseToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
