"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_ENABLED, SUPABASE_URL } from "../env";

let client: SupabaseClient | null = null;

/** Browser client, or null when Supabase isn't configured yet. */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!SUPABASE_ENABLED) return null;
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
