// This file is for client-side auth checking only (SPA mode)
import { supabase } from "./client";

/**
 * Client-side function to check if user is authenticated
 */
export async function requireSupabaseAuth() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Unauthorized");
  return data.user;
}

/**
 * Get current session token (useful for API calls)
 */
export async function getSupabaseToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
