"use client";

import { Check, ChevronDown, Heart, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAnimeProgress, useEntry, useFavorites, useRemoveEntry, useToggleFavorite, useUpsertEntry } from "@/lib/hooks";
import type { AnimeCard, ListStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ReportButton } from "./report-button";

export const STATUS_OPTIONS: { value: ListStatus; label: string }[] = [
  { value: "watching", label: "Watching" },
  { value: "plan", label: "Plan to Watch" },
  { value: "completed", label: "Completed" },
  { value: "dropped", label: "Dropped" },
];

export function entryFromAnime(a: AnimeCard) {
  return {
    anilist_id: a.id,
    mal_id: a.idMal,
    title: a.title,
    poster: a.cover,
    format: a.format,
    episodes_total: a.episodes,
    genres: a.genres,
  };
}

export function DetailActions({ anime, canPlay }: { anime: AnimeCard; canPlay: boolean }) {
  const { data: progress } = useAnimeProgress(anime.id);
  const latest = progress?.length
    ? [...progress].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]
    : null;
  let resumeEp = 1;
  let label = "Watch now";
  if (latest) {
    const done = latest.completed && (!anime.episodes || latest.episode < anime.episodes);
    resumeEp = done ? latest.episode + 1 : latest.episode;
    label = done ? `Watch EP ${resumeEp}` : `Resume EP ${resumeEp}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canPlay ? (
        <Link
          href={`/watch/${anime.id}/${resumeEp}`}
          className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-bold text-white shadow-lg shadow-accent/25 transition-colors hover:bg-accent-hover"
        >
          <Play className="size-5 fill-white" /> {label}
        </Link>
      ) : (
        <span className="rounded-full bg-elev-2 px-6 py-3 font-semibold text-muted">Not yet available</span>
      )}
      <ListButton anime={anime} />
      <FavoriteButton anime={anime} />
      <ReportButton anilistId={anime.id} />
    </div>
  );
}

export function ListButton({ anime, compact = false }: { anime: AnimeCard; compact?: boolean }) {
  const { data: entry } = useEntry(anime.id);
  const upsert = useUpsertEntry();
  const remove = useRemoveEntry();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = STATUS_OPTIONS.find((o) => o.value === entry?.status);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-2 rounded-full px-5 py-3 font-semibold backdrop-blur transition-colors",
          current ? "bg-white/90 text-black hover:bg-white" : "bg-white/12 hover:bg-white/20",
          compact && "px-4 py-2 text-sm",
        )}
      >
        {current ? <Check className="size-5" /> : <Plus className="size-5" />}
        {current ? current.label : "Add to List"}
        <ChevronDown className="size-4 opacity-70" />
      </button>
      {open && (
        <div className="fade-in absolute left-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-elev py-1 shadow-2xl shadow-black/60">
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                upsert.mutate({ ...entryFromAnime(anime), status: o.value });
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-elev-2"
            >
              {o.label}
              {entry?.status === o.value && <Check className="size-4 text-accent" />}
            </button>
          ))}
          {entry && (
            <button
              type="button"
              onClick={() => {
                remove.mutate(anime.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-t border-line px-4 py-2.5 text-left text-sm text-danger hover:bg-elev-2"
            >
              <Trash2 className="size-4" /> Remove from list
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function FavoriteButton({ anime }: { anime: AnimeCard }) {
  const { data: favs } = useFavorites();
  const toggle = useToggleFavorite();
  const on = Boolean(favs?.some((f) => f.anilist_id === anime.id));
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Remove from favorites" : "Add to favorites"}
      onClick={() =>
        toggle.mutate({ fav: { anilist_id: anime.id, mal_id: anime.idMal, title: anime.title, poster: anime.cover }, on: !on })
      }
      className="flex size-12 items-center justify-center rounded-full bg-white/12 backdrop-blur transition-colors hover:bg-white/20"
    >
      <Heart className={cn("size-5 transition", on && "scale-110 fill-accent text-accent")} />
    </button>
  );
}
