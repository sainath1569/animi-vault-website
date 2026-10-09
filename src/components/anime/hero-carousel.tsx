"use client";

/* eslint-disable @next/next/no-img-element */
import { Info, Play, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AnimeCard } from "@/lib/types";
import { cn, formatLabel, statusLabel } from "@/lib/utils";

const INTERVAL = 8000;

export function HeroCarousel({ items }: { items: AnimeCard[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = items.length;

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setTimeout(() => go(index + 1), INTERVAL);
    return () => clearTimeout(t);
  }, [index, paused, count, go]);

  if (!count) return null;
  const a = items[index];

  return (
    <section
      className="relative -mt-[var(--nav-h)] h-[78vh] min-h-[460px] max-h-[860px] w-full overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      aria-roledescription="carousel"
    >
      {items.map((item, i) => (
        <div
          key={item.id}
          className={cn("absolute inset-0 transition-opacity duration-1000", i === index ? "opacity-100" : "opacity-0")}
          aria-hidden={i !== index}
        >
          <img
            src={item.banner ?? item.cover}
            alt=""
            className={cn(
              "size-full object-cover",
              !item.banner && "scale-110 blur-2xl",
              i === index && "animate-[heroZoom_12s_ease-out_both]",
            )}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "auto"}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-black/40" />

      <div className="relative mx-auto flex h-full max-w-[1600px] items-end px-4 pb-16 md:px-8 md:pb-24">
        <div key={a.id} className="fade-in max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-accent">#{index + 1} Spotlight</p>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-[1.05] tracking-tight drop-shadow-lg sm:text-4xl md:text-6xl">
            {a.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg/85">
            {a.score ? (
              <span className="flex items-center gap-1 font-semibold">
                <Star className="size-4 fill-warn text-warn" /> {(a.score / 10).toFixed(1)}
              </span>
            ) : null}
            {[formatLabel(a.format), a.year, a.episodes ? `${a.episodes} episodes` : null, statusLabel(a.status)]
              .filter(Boolean)
              .map((x) => (
                <span key={String(x)} className="before:mr-3 before:text-dim before:content-['•'] first:before:hidden">
                  {x}
                </span>
              ))}
          </div>
          {a.description && (
            <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-fg/75 md:text-base">{a.description}</p>
          )}
          <div className="mt-6 flex gap-3">
            <Link
              href={`/watch/${a.id}/1`}
              className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover md:text-base"
            >
              <Play className="size-5 fill-white" /> Watch now
            </Link>
            <Link
              href={`/anime/${a.id}`}
              className="flex items-center gap-2 rounded-full bg-white/15 px-6 py-3 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/25 md:text-base"
            >
              <Info className="size-5" /> Details
            </Link>
          </div>
        </div>
      </div>

      {count > 1 && (
        <div className="absolute bottom-6 right-4 flex gap-1.5 md:right-8">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show ${item.title}`}
              onClick={() => go(i)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index ? "w-8 bg-accent" : "w-3 bg-white/30 hover:bg-white/60",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
