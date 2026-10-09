"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useNow } from "@/lib/use-now";
import type { ScheduleItem } from "@/lib/types";
import { cn, formatCountdown, formatLabel } from "@/lib/utils";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function ScheduleView({ items }: { items: ScheduleItem[] }) {
  const now = useNow();
  const [selected, setSelected] = useState(0);
  const today = now == null ? null : dayKey(new Date(now));

  // Seven local days starting today. Computed only on the client (timezone).
  const days = useMemo(() => {
    if (today == null) return [];
    const [y, m, d] = today.split("-").map(Number);
    return Array.from({ length: 7 }, (_, i) => new Date(y, m, d + i));
  }, [today]);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of items) {
      const k = dayKey(new Date(it.airingAt * 1000));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(it);
    }
    return map;
  }, [items]);

  if (now == null) {
    return (
      <div className="mt-6 space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  const day = days[selected];
  const list = day ? (byDay.get(dayKey(day)) ?? []) : [];
  const nowSec = Math.floor(now / 1000);

  return (
    <div>
      <nav className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1" aria-label="Days">
        {days.map((d, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setSelected(i)}
            className={cn(
              "flex min-w-[74px] shrink-0 flex-col items-center rounded-xl px-3 py-2 transition-colors",
              i === selected ? "bg-accent text-white" : "bg-elev text-muted hover:text-fg",
            )}
          >
            <span className="text-xs font-semibold uppercase">
              {i === 0 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" })}
            </span>
            <span className="text-lg font-bold">{d.getDate()}</span>
          </button>
        ))}
      </nav>

      <ul className="mt-6 space-y-2">
        {list.length === 0 && <li className="py-16 text-center text-muted">Nothing scheduled for this day.</li>}
        {list.map((s) => {
          const aired = s.airingAt <= nowSec;
          return (
            <li key={s.id}>
              <Link
                href={aired ? `/watch/${s.anime.id}/${s.episode}` : `/anime/${s.anime.id}`}
                prefetch={false}
                className={cn(
                  "group flex items-center gap-4 rounded-xl bg-elev p-2.5 ring-1 ring-white/5 transition hover:bg-elev-2 hover:ring-accent/40",
                  aired && "opacity-75",
                )}
              >
                <span className="w-16 shrink-0 text-center text-sm font-bold tabular-nums">
                  {new Date(s.airingAt * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
                <img src={s.anime.cover} alt="" loading="lazy" className="h-16 w-11 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-accent">{s.anime.title}</p>
                  <p className="text-xs text-dim">
                    Episode {s.episode}
                    {s.anime.episodes ? ` of ${s.anime.episodes}` : ""} · {formatLabel(s.anime.format)}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums",
                    aired ? "bg-ok/15 text-ok" : "bg-accent/15 text-fg",
                  )}
                >
                  {aired ? "Aired" : formatCountdown(s.airingAt - nowSec)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
