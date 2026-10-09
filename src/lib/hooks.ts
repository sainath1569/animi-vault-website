"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth, useTrackCtx } from "@/components/providers";
import * as T from "./tracking";
import type { ListEntry, UserSettings } from "./types";
import { DEFAULT_SETTINGS } from "./types";

/** Query keys include the user id so guest and account data never mix. */
function useKey(...parts: unknown[]) {
  const { user, ready } = useAuth();
  return { key: [...parts, user?.id ?? "guest"], ready };
}

export function useSettings() {
  const ctx = useTrackCtx();
  const { key, ready } = useKey("settings");
  const q = useQuery({ queryKey: key, queryFn: () => T.loadSettings(ctx), enabled: ready });
  return { settings: q.data ?? DEFAULT_SETTINGS, loaded: q.isSuccess };
}

export function useSaveSettings() {
  const ctx = useTrackCtx();
  const qc = useQueryClient();
  const { key } = useKey("settings");
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) => T.saveSettings(ctx, patch),
    onSuccess: (data) => qc.setQueryData(key, data),
  });
}

export function useList() {
  const ctx = useTrackCtx();
  const { key, ready } = useKey("list");
  return useQuery({ queryKey: key, queryFn: () => T.getList(ctx), enabled: ready });
}

export function useEntry(anilistId: number) {
  const ctx = useTrackCtx();
  const { key, ready } = useKey("entry", anilistId);
  return useQuery({ queryKey: key, queryFn: () => T.getEntry(ctx, anilistId), enabled: ready });
}

export function useUpsertEntry() {
  const ctx = useTrackCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: T.EntryInput) => T.upsertEntry(ctx, input),
    onSuccess: (entry: ListEntry) => {
      qc.setQueryData(["entry", entry.anilist_id, ctx.userId ?? "guest"], entry);
      void qc.invalidateQueries({ queryKey: ["list"] });
    },
  });
}

export function useRemoveEntry() {
  const ctx = useTrackCtx();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (anilistId: number) => T.removeEntry(ctx, anilistId),
    onSuccess: (_, anilistId) => {
      qc.setQueryData(["entry", anilistId, ctx.userId ?? "guest"], null);
      void qc.invalidateQueries({ queryKey: ["list"] });
    },
  });
}

export function useFavorites() {
  const ctx = useTrackCtx();
  const { key, ready } = useKey("favs");
  return useQuery({ queryKey: key, queryFn: () => T.getFavorites(ctx), enabled: ready });
}

export function useToggleFavorite() {
  const ctx = useTrackCtx();
  const qc = useQueryClient();
  const key = ["favs", ctx.userId ?? "guest"];
  return useMutation({
    mutationFn: ({ fav, on }: { fav: Omit<T.Favorite, "created_at">; on: boolean }) => T.setFavorite(ctx, fav, on),
    onMutate: async ({ fav, on }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<T.Favorite[]>(key);
      qc.setQueryData<T.Favorite[]>(key, (old = []) =>
        on
          ? [{ ...fav, created_at: new Date().toISOString() }, ...old.filter((f) => f.anilist_id !== fav.anilist_id)]
          : old.filter((f) => f.anilist_id !== fav.anilist_id),
      );
      return { prev };
    },
    onError: (_e, _v, c) => qc.setQueryData(key, c?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useContinueWatching() {
  const ctx = useTrackCtx();
  const { key, ready } = useKey("continue");
  return useQuery({ queryKey: key, queryFn: () => T.getContinueWatching(ctx), enabled: ready, staleTime: 10_000 });
}

export function useAnimeProgress(anilistId: number) {
  const ctx = useTrackCtx();
  const { key, ready } = useKey("progress", anilistId);
  return useQuery({ queryKey: key, queryFn: () => T.getAnimeProgress(ctx, anilistId), enabled: ready });
}

export function useHistory() {
  const ctx = useTrackCtx();
  const { key, ready } = useKey("history");
  return useQuery({ queryKey: key, queryFn: () => T.getHistory(ctx), enabled: ready });
}
