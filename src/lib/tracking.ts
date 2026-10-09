"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_SETTINGS,
  type ListEntry,
  type ListStatus,
  type UserSettings,
  type WatchProgress,
} from "./types";

/**
 * Tracking storage. Signed-in users read and write Supabase (RLS scopes every
 * row to them); guests use localStorage, which is merged into the account on
 * sign-in.
 */
export interface TrackCtx {
  supabase: SupabaseClient | null;
  userId: string | null;
}

export interface Favorite {
  anilist_id: number;
  mal_id: number | null;
  title: string;
  poster: string | null;
  created_at: string;
}

export interface HistoryItem {
  id?: number;
  anilist_id: number;
  episode: number;
  title: string | null;
  poster: string | null;
  watched_at: string;
}

const KEYS = {
  progress: "ab:progress",
  list: "ab:list",
  favs: "ab:favs",
  history: "ab:history",
  settings: "ab:settings",
} as const;

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; tracking is best-effort for guests.
  }
}

const online = (ctx: TrackCtx): ctx is { supabase: SupabaseClient; userId: string } =>
  Boolean(ctx.supabase && ctx.userId);

// ── Settings ─────────────────────────────────────────────

export async function loadSettings(ctx: TrackCtx): Promise<UserSettings> {
  const local = { ...DEFAULT_SETTINGS, ...readLocal<Partial<UserSettings>>(KEYS.settings, {}) };
  if (!online(ctx)) return local;
  const { data } = await ctx.supabase.from("user_settings").select("*").eq("user_id", ctx.userId).maybeSingle();
  if (!data) return local;
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    subtitle_prefs: { ...DEFAULT_SETTINGS.subtitle_prefs, ...(data.subtitle_prefs ?? {}) },
  } as UserSettings;
}

export async function saveSettings(ctx: TrackCtx, patch: Partial<UserSettings>) {
  const next = { ...(await loadSettings(ctx)), ...patch };
  writeLocal(KEYS.settings, next);
  if (online(ctx)) {
    const { error } = await ctx.supabase.from("user_settings").upsert({ user_id: ctx.userId, ...next });
    if (error) throw error;
  }
  return next;
}

// ── Progress ─────────────────────────────────────────────

type ProgressInput = Omit<WatchProgress, "updated_at">;

export async function saveProgress(ctx: TrackCtx, p: ProgressInput) {
  const row = { ...p, updated_at: new Date().toISOString() };
  if (online(ctx)) {
    const { error } = await ctx.supabase.from("watch_progress").upsert({ user_id: ctx.userId, ...row });
    if (error) throw error;
    return;
  }
  const all = readLocal<Record<string, WatchProgress>>(KEYS.progress, {});
  all[`${p.anilist_id}:${p.episode}`] = row;
  // Keep guest storage bounded.
  const entries = Object.entries(all).sort((a, b) => b[1].updated_at.localeCompare(a[1].updated_at));
  writeLocal(KEYS.progress, Object.fromEntries(entries.slice(0, 500)));
}

/** Beacon-safe save used on page unload, where async fetches may be cut off. */
export function saveProgressOnUnload(ctx: TrackCtx, p: ProgressInput, accessToken: string | null) {
  if (!online(ctx) || !accessToken) {
    void saveProgress(ctx, p);
    return;
  }
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/watch_progress?on_conflict=user_id,anilist_id,episode`;
  const body = JSON.stringify({ user_id: ctx.userId, ...p, updated_at: new Date().toISOString() });
  void fetch(url, {
    method: "POST",
    keepalive: true,
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body,
  }).catch(() => {});
}

export async function getAnimeProgress(ctx: TrackCtx, anilistId: number): Promise<WatchProgress[]> {
  if (online(ctx)) {
    const { data } = await ctx.supabase
      .from("watch_progress")
      .select("*")
      .eq("anilist_id", anilistId)
      .order("episode");
    return (data ?? []) as WatchProgress[];
  }
  const all = readLocal<Record<string, WatchProgress>>(KEYS.progress, {});
  return Object.values(all)
    .filter((p) => p.anilist_id === anilistId)
    .sort((a, b) => a.episode - b.episode);
}

export interface ContinueItem extends WatchProgress {
  /** Episode to open: the unfinished one, or the next after a finished one. */
  resumeEpisode: number;
  percent: number;
}

export async function getContinueWatching(ctx: TrackCtx, limit = 20): Promise<ContinueItem[]> {
  let rows: WatchProgress[];
  if (online(ctx)) {
    const { data } = await ctx.supabase
      .from("watch_progress")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    rows = (data ?? []) as WatchProgress[];
  } else {
    rows = Object.values(readLocal<Record<string, WatchProgress>>(KEYS.progress, {})).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    );
  }
  const seen = new Set<number>();
  const out: ContinueItem[] = [];
  for (const r of rows) {
    if (seen.has(r.anilist_id)) continue;
    seen.add(r.anilist_id);
    if (r.completed) {
      // Finished the last known episode: nothing to continue.
      if (r.episodes_total && r.episode >= r.episodes_total) continue;
      out.push({ ...r, resumeEpisode: r.episode + 1, percent: 0 });
    } else {
      const percent = r.duration_sec ? Math.min(100, (r.position_sec / r.duration_sec) * 100) : 0;
      out.push({ ...r, resumeEpisode: r.episode, percent });
    }
    if (out.length >= limit) break;
  }
  return out;
}

export async function removeFromContinue(ctx: TrackCtx, anilistId: number) {
  if (online(ctx)) {
    await ctx.supabase.from("watch_progress").delete().eq("anilist_id", anilistId);
    return;
  }
  const all = readLocal<Record<string, WatchProgress>>(KEYS.progress, {});
  for (const k of Object.keys(all)) if (all[k].anilist_id === anilistId) delete all[k];
  writeLocal(KEYS.progress, all);
}

// ── History ──────────────────────────────────────────────

export async function addHistory(ctx: TrackCtx, item: Omit<HistoryItem, "watched_at" | "id">) {
  const row = { ...item, watched_at: new Date().toISOString() };
  if (online(ctx)) {
    await ctx.supabase.from("watch_history").insert({ user_id: ctx.userId, ...row });
    return;
  }
  const list = readLocal<HistoryItem[]>(KEYS.history, []);
  list.unshift(row);
  writeLocal(KEYS.history, list.slice(0, 300));
}

export async function getHistory(ctx: TrackCtx, limit = 200): Promise<HistoryItem[]> {
  if (online(ctx)) {
    const { data } = await ctx.supabase
      .from("watch_history")
      .select("id, anilist_id, episode, title, poster, watched_at")
      .order("watched_at", { ascending: false })
      .limit(limit);
    return (data ?? []) as HistoryItem[];
  }
  return readLocal<HistoryItem[]>(KEYS.history, []).slice(0, limit);
}

export async function clearHistory(ctx: TrackCtx) {
  if (online(ctx)) {
    await ctx.supabase.from("watch_history").delete().eq("user_id", ctx.userId);
    return;
  }
  writeLocal(KEYS.history, []);
}

// ── List ─────────────────────────────────────────────────

export type EntryInput = Pick<ListEntry, "anilist_id" | "title"> & Partial<Omit<ListEntry, "updated_at">>;

export async function getList(ctx: TrackCtx): Promise<ListEntry[]> {
  if (online(ctx)) {
    const { data } = await ctx.supabase
      .from("list_entries")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("updated_at", { ascending: false });
    return (data ?? []) as ListEntry[];
  }
  return Object.values(readLocal<Record<string, ListEntry>>(KEYS.list, {})).sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
}

export async function getEntry(ctx: TrackCtx, anilistId: number): Promise<ListEntry | null> {
  if (online(ctx)) {
    const { data } = await ctx.supabase
      .from("list_entries")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("anilist_id", anilistId)
      .maybeSingle();
    return (data as ListEntry) ?? null;
  }
  return readLocal<Record<string, ListEntry>>(KEYS.list, {})[anilistId] ?? null;
}

export async function upsertEntry(ctx: TrackCtx, input: EntryInput): Promise<ListEntry> {
  const existing = await getEntry(ctx, input.anilist_id);
  const entry: ListEntry = {
    mal_id: null,
    poster: null,
    format: null,
    episodes_total: null,
    genres: [],
    status: "plan",
    progress: 0,
    score: null,
    notes: null,
    ...existing,
    ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)),
    updated_at: new Date().toISOString(),
  } as ListEntry;
  if (online(ctx)) {
    const { data, error } = await ctx.supabase
      .from("list_entries")
      .upsert({ user_id: ctx.userId, ...entry }, { onConflict: "user_id,anilist_id" })
      .select("*")
      .single();
    if (error) throw error;
    return data as ListEntry;
  }
  const all = readLocal<Record<string, ListEntry>>(KEYS.list, {});
  all[entry.anilist_id] = entry;
  writeLocal(KEYS.list, all);
  return entry;
}

export async function removeEntry(ctx: TrackCtx, anilistId: number) {
  if (online(ctx)) {
    await ctx.supabase.from("list_entries").delete().eq("user_id", ctx.userId).eq("anilist_id", anilistId);
    return;
  }
  const all = readLocal<Record<string, ListEntry>>(KEYS.list, {});
  delete all[anilistId];
  writeLocal(KEYS.list, all);
}

/** Moves a show to Watching on first play, and to Completed after the last episode. */
export async function autoStatus(
  ctx: TrackCtx,
  info: EntryInput & { episode: number; finished: boolean },
) {
  const existing = await getEntry(ctx, info.anilist_id);
  const { episode, finished, ...base } = info;
  const progress = Math.max(existing?.progress ?? 0, finished ? episode : 0);
  let status: ListStatus = existing?.status ?? "watching";
  if (!existing || existing.status === "plan") status = "watching";
  if (finished && base.episodes_total && episode >= base.episodes_total) status = "completed";
  if (existing && existing.status === status && existing.progress === progress) return existing;
  return upsertEntry(ctx, { ...base, status, progress });
}

// ── Favorites ────────────────────────────────────────────

export async function getFavorites(ctx: TrackCtx): Promise<Favorite[]> {
  if (online(ctx)) {
    const { data } = await ctx.supabase
      .from("favorites")
      .select("anilist_id, mal_id, title, poster, created_at")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false });
    return (data ?? []) as Favorite[];
  }
  return Object.values(readLocal<Record<string, Favorite>>(KEYS.favs, {})).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
}

export async function setFavorite(ctx: TrackCtx, fav: Omit<Favorite, "created_at">, on: boolean) {
  if (online(ctx)) {
    if (on) {
      const { error } = await ctx.supabase
        .from("favorites")
        .upsert({ user_id: ctx.userId, ...fav, created_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      await ctx.supabase.from("favorites").delete().eq("user_id", ctx.userId).eq("anilist_id", fav.anilist_id);
    }
    return;
  }
  const all = readLocal<Record<string, Favorite>>(KEYS.favs, {});
  if (on) all[fav.anilist_id] = { ...fav, created_at: new Date().toISOString() };
  else delete all[fav.anilist_id];
  writeLocal(KEYS.favs, all);
}

// ── Guest → account merge ────────────────────────────────

export async function mergeGuestData(ctx: TrackCtx) {
  if (!online(ctx)) return;
  const progress = Object.values(readLocal<Record<string, WatchProgress>>(KEYS.progress, {}));
  const list = Object.values(readLocal<Record<string, ListEntry>>(KEYS.list, {}));
  const favs = Object.values(readLocal<Record<string, Favorite>>(KEYS.favs, {}));
  const history = readLocal<HistoryItem[]>(KEYS.history, []);
  if (!progress.length && !list.length && !favs.length && !history.length) return;

  const uid = ctx.userId;
  const ops: PromiseLike<unknown>[] = [];
  if (progress.length) {
    ops.push(ctx.supabase.from("watch_progress").upsert(progress.map((p) => ({ user_id: uid, ...p }))));
  }
  if (list.length) {
    // Don't overwrite entries the account already has.
    ops.push(
      ctx.supabase
        .from("list_entries")
        .upsert(list.map((e) => ({ user_id: uid, ...e })), { onConflict: "user_id,anilist_id", ignoreDuplicates: true }),
    );
  }
  if (favs.length) {
    ops.push(ctx.supabase.from("favorites").upsert(favs.map((f) => ({ user_id: uid, ...f })), { ignoreDuplicates: true }));
  }
  if (history.length) {
    ops.push(
      ctx.supabase.from("watch_history").insert(
        history.slice(0, 100).map((h) => ({
          user_id: uid,
          anilist_id: h.anilist_id,
          episode: h.episode,
          title: h.title,
          poster: h.poster,
          watched_at: h.watched_at,
        })),
      ),
    );
  }
  await Promise.all(ops);
  for (const k of [KEYS.progress, KEYS.list, KEYS.favs, KEYS.history]) localStorage.removeItem(k);
}
