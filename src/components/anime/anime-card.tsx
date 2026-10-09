/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Play, Star } from "lucide-react";
import type { AnimeCard as Card } from "@/lib/types";
import { cn, formatLabel } from "@/lib/utils";

interface Props {
  anime: Card;
  rank?: number;
  className?: string;
  /** Extra label under the title, e.g. "EP 5 · 2h ago". */
  subtitle?: string;
  priority?: boolean;
}

export function AnimeCard({ anime, rank, className, subtitle, priority }: Props) {
  const meta = subtitle ?? [formatLabel(anime.format), anime.year, anime.episodes ? `${anime.episodes} eps` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/anime/${anime.id}`}
      prefetch={false}
      className={cn("group relative block w-full outline-none", className)}
      title={anime.title}
    >
      <div
        className="relative aspect-[2/3] overflow-hidden rounded-lg bg-elev ring-1 ring-white/5 transition-all duration-300 group-hover:ring-accent/60 group-focus-visible:ring-2 group-focus-visible:ring-accent"
        style={{ backgroundColor: anime.coverColor ?? undefined }}
      >
        <img
          src={anime.cover}
          alt={anime.title}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/0 opacity-70 transition-opacity group-hover:opacity-100" />
        {anime.score ? (
          <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold backdrop-blur">
            <Star className="size-3 fill-warn text-warn" />
            {(anime.score / 10).toFixed(1)}
          </span>
        ) : null}
        {anime.nextAiring && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-accent/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
            EP {anime.nextAiring.episode - 1 > 0 ? anime.nextAiring.episode - 1 : "Soon"}
          </span>
        )}
        {rank != null && (
          <span className="absolute bottom-1 left-2 font-[family-name:var(--font-display)] text-4xl font-extrabold text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            {rank}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent/95 shadow-lg shadow-black/50">
            <Play className="ml-0.5 size-5 fill-white text-white" />
          </span>
        </span>
      </div>
      <div className="mt-2 px-0.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug text-fg/95 group-hover:text-fg">{anime.title}</p>
        {meta && <p className="mt-0.5 truncate text-xs text-dim">{meta}</p>}
      </div>
    </Link>
  );
}

export function AnimeCardSkeleton() {
  return (
    <div className="w-full">
      <div className="skeleton aspect-[2/3] rounded-lg" />
      <div className="skeleton mt-2 h-3.5 w-4/5 rounded" />
      <div className="skeleton mt-1.5 h-3 w-1/2 rounded" />
    </div>
  );
}
