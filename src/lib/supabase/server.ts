import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_ENABLED, SUPABASE_URL } from "../env";

/** Request-scoped client acting as the signed-in user (RLS applies). */
export async function getSupabaseServer(): Promise<SupabaseClient | null> {
  if (!SUPABASE_ENABLED) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client. Bypasses RLS: only use after an explicit permission check. */
export function getSupabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_ENABLED || !key) return null;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export interface Viewer {
  user: User;
  profile: { id: string; username: string | null; avatar_url: string | null; role: string; banned: boolean };
}

/** The signed-in user and profile for this request, memoized per render. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, role, banned")
    .eq("id", data.user.id)
    .maybeSingle();
  return {
    user: data.user,
    profile: profile ?? { id: data.user.id, username: null, avatar_url: null, role: "user", banned: false },
  };
});

export async function isAdmin() {
  const viewer = await getViewer();
  return Boolean(viewer && viewer.profile.role === "admin" && !viewer.profile.banned);
}

/**
 * Service-role client for admin pages. Each page calls this itself because
 * layouts don't re-run on client navigation, so a layout check alone isn't enough.
 */
export async function adminDb(): Promise<SupabaseClient> {
  if (!(await isAdmin())) notFound();
  const db = getSupabaseAdmin();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return db;
}
