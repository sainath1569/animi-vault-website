import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cached } from "./cache";
import { SUPABASE_ANON_KEY, SUPABASE_ENABLED, SUPABASE_URL } from "./env";
import type { AnimeCard } from "./types";

// Public, cookie-less reads so pages using them can still be statically cached.
const anon = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

export interface Announcement {
  id: number;
  message: string;
  link: string | null;
}

export interface Overrides {
  hidden: Set<number>;
  featured: number[];
  customIds: Map<number, Record<string, unknown>>;
}

export function getAnnouncements(): Promise<Announcement[]> {
  if (!anon) return Promise.resolve([]);
  return cached("db:announcements", 60, async () => {
    const { data } = await anon
      .from("announcements")
      .select("id, message, link")
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(3);
    return (data ?? []) as Announcement[];
  }).catch(() => []);
}

export function getOverrides(): Promise<Overrides> {
  const empty: Overrides = { hidden: new Set(), featured: [], customIds: new Map() };
  if (!anon) return Promise.resolve(empty);
  return cached("db:overrides", 60, async () => {
    const { data } = await anon.from("anime_overrides").select("anilist_id, hidden, featured, featured_order, custom_ids");
    const rows = (data ?? []) as {
      anilist_id: number;
      hidden: boolean;
      featured: boolean;
      featured_order: number;
      custom_ids: Record<string, unknown>;
    }[];
    return {
      hidden: new Set(rows.filter((r) => r.hidden).map((r) => r.anilist_id)),
      featured: rows
        .filter((r) => r.featured && !r.hidden)
        .sort((a, b) => a.featured_order - b.featured_order)
        .map((r) => r.anilist_id),
      customIds: new Map(
        rows.filter((r) => r.custom_ids && Object.keys(r.custom_ids).length).map((r) => [r.anilist_id, r.custom_ids]),
      ),
    };
  }).catch(() => empty);
}

export function withoutHidden(items: AnimeCard[], o: Overrides) {
  return o.hidden.size ? items.filter((a) => !o.hidden.has(a.id)) : items;
}
