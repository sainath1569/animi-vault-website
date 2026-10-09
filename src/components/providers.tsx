"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { mergeGuestData, type TrackCtx } from "@/lib/tracking";

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  is_public: boolean;
  banned: boolean;
}

interface AuthState {
  supabase: SupabaseClient | null;
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  /** False until the first session check finishes. */
  ready: boolean;
  enabled: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside Providers");
  return ctx;
}

/** Storage context for the tracking helpers. */
export function useTrackCtx(): TrackCtx {
  const { supabase, user } = useAuth();
  return useMemo(() => ({ supabase, userId: user?.id ?? null }), [supabase, user?.id]);
}

function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabaseBrowser(), []);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(!supabase);

  async function loadProfile(uid: string | undefined) {
    if (!supabase || !uid) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, username, avatar_url, bio, role, is_public, banned")
      .eq("id", uid)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        void loadProfile(next?.user.id);
      }
      if (event === "SIGNED_IN" && next) {
        void mergeGuestData({ supabase, userId: next.user.id }).finally(() => queryClient.invalidateQueries());
      }
      if (event === "SIGNED_OUT") queryClient.clear();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const value: AuthState = {
    supabase,
    session,
    user: session?.user ?? null,
    profile,
    ready,
    enabled: Boolean(supabase),
    refreshProfile: () => loadProfile(session?.user.id),
    signOut: async () => {
      await supabase?.auth.signOut();
      router.replace("/");
      router.refresh();
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
