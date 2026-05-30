// This file is no longer used in SPA mode
// Authentication is handled directly in components and via Supabase client
// Kept for reference/compatibility

import { supabase } from './client'

/**
 * Helper to attach auth token to fetch requests
 * Useful for API calls that need authentication
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}
