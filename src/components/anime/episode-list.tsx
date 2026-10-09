"use client";

/* eslint-disable @next/next/no-img-element */
import { Check, LayoutGrid, List, Play, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimeProgress } from "@/lib/hooks";
import type { EpisodeItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGE = 100;

interface Props {
  animeId: number;
  episodes: EpisodeItem[];
  current?: number;
  /** Tighter layout for the watch-page drawer. */
  variant?: "page" | "drawer";
  fallbackThumb?: string | null;
}

export function EpisodeList({ animeId, episodes, current, variant = "page", fallbackThumb }: Props) {
  const { data: progress } = useAnimeProgress(animeId);
  const hasThumbs = episodes.some((e) => e.thumbnail);
  const [view, setView] = useState<"grid" | "list">(variant === "drawer" || !hasThumbs || episodes.length > 60 ? "list" : "grid");
  const [query, setQuery] = useState("");
  const ranges = Math.ceil(episodes.length / RANGE);
  const initialRange = current ? Math.floor((episodes.findIndex((e) => e.number === current) || 0) / RANGE) : 0;
  const [range, setRange] = useState(Math.max(0, initialRange));
  const activeRef = useRef<HTMLAnchorElement>(null);

  const progressByEp = useMemo(() => {
    const m = new Map<number, { completed: boolean; percent: number }>();
    for (const p of progress ?? []) {
      m.set(p.episode, { completed: p.completed, percent: p.duration_sec ? (p.position_sec / p.duration_sec) * 100 : 0 });
    }
    return m;
  }, [progress]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return episodes.filter((e) => String(e.number) === q || e.title?.toLowerCase().includes(q)).slice(0, 200);
    }
    return episodes.slice(range * RANGE, range * RANGE + RANGE);
  }, [episodes, range, query]);

  useEffect(() => {
    if (variant === "drawer") activeRef.current?.scrollIntoView({ block: "center" });
  }, [variant, range]);

  if (!episodes.length) {
    return <p className="py-8 text-sm text-muted">No episodes available yet.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {ranges > 1 && !query && (
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="rounded-lg border border-line bg-elev px-3 py-2 text-sm outline-none focus:border-accent"
            aria-label="Episode range"
          >
            {Array.from({ length: ranges }, (_, i) => {
              const from = episodes[i * RANGE]?.number;
              const to = episodes[Math.min(episodes.length, (i + 1) * RANGE) - 1]?.number;
              return (
                <option key={i} value={i}>
                  EP {from}–{to}
                </option>
              );
            })}
          </select>
        )}
        {episodes.length > 12 && (
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-elev px-3 py-2 sm:max-w-56">
            <Search className="size-4 shrink-0 text-dim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find episode"
              inputMode="search"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
            />
          </label>
        )}
        {variant === "page" && hasThumbs && (
          <div className="ml-auto flex rounded-lg border border-line p-0.5">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setView("grid")}
              className={cn("rounded-md p-1.5", view === "grid" ? "bg-elev-2 text-fg" : "text-dim")}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setView("list")}
              className={cn("rounded-md p-1.5", view === "list" ? "bg-elev-2 text-fg" : "text-dim")}
            >
              <List className="size-4" />
            </button>
          </div>
        )}
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((ep) => {
            const p = progressByEp.get(ep.number);
            return (
              <Link
                key={ep.number}
                href={`/watch/${animeId}/${ep.number}`}
                className="group"
                ref={ep.number === current ? activeRef : undefined}
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-elev ring-1 ring-white/5 transition group-hover:ring-accent/60">
                  {ep.thumbnail || fallbackThumb ? (
                    <img
                      src={ep.thumbnail ?? fallbackThumb!}
                      alt=""
                      loading="lazy"
                      className={cn("size-full object-cover transition-transform duration-500 group-hover:scale-105", !ep.thumbnail && "opacity-40 blur-sm")}
                    />
                  ) : null}
                  <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-xs font-semibold">EP {ep.number}</span>
                  <EpisodeTags ep={ep} className="absolute right-2 top-2" />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex size-11 items-center justify-center rounded-full bg-accent">
                      <Play className="ml-0.5 size-5 fill-white text-white" />
                    </span>
                  </span>
                  {p && (
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
                      <div className="h-full bg-accent" style={{ width: `${p.completed ? 100 : p.percent}%` }} />
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm font-medium text-fg/90 group-hover:text-fg">
                  {ep.title ?? `Episode ${ep.number}`}
                </p>
                {ep.aired && <p className="text-xs text-dim">{ep.aired}</p>}
              </Link>
            );
          })}
        </div>
      ) : (
        <ul className={cn("grid grid-cols-[minmax(0,1fr)] gap-1.5", variant === "page" && "sm:grid-cols-2 xl:grid-cols-3")}>
          {shown.map((ep) => {
            const p = progressByEp.get(ep.number);
            const isCurrent = ep.number === current;
            return (
              <li key={ep.number}>
                <Link
                  href={`/watch/${animeId}/${ep.number}`}
                  ref={isCurrent ? activeRef : undefined}
                  aria-current={isCurrent ? "true" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 text-sm transition-colors",
                    isCurrent ? "bg-accent/15 text-fg ring-1 ring-accent/50" : "bg-elev hover:bg-elev-2",
                  )}
                >
                  <span className={cn("w-10 shrink-0 font-semibold tabular-nums", isCurrent ? "text-accent" : "text-dim")}>
                    {ep.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{ep.title ?? `Episode ${ep.number}`}</span>
                  <EpisodeTags ep={ep} />
                  {p?.completed && <Check className="size-4 shrink-0 text-ok" aria-label="Watched" />}
                  {isCurrent && <Play className="size-3.5 shrink-0 fill-accent text-accent" />}
                  {p && !p.completed && p.percent > 2 && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
                      <span className="block h-full bg-accent" style={{ width: `${p.percent}%` }} />
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EpisodeTags({ ep, className }: { ep: EpisodeItem; className?: string }) {
  if (!ep.filler && !ep.recap) return null;
  return (
    <span className={cn("flex gap-1", className)}>
      {ep.filler && <span className="rounded bg-warn/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">Filler</span>}
      {ep.recap && <span className="rounded bg-sky-400/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-black">Recap</span>}
    </span>
  );
}
