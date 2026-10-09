"use client";

/* eslint-disable @next/next/no-img-element */
import { useQueryClient } from "@tanstack/react-query";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTrackCtx } from "@/components/providers";
import { EmptyState } from "@/components/ui/error-state";
import { SyncBanner } from "@/components/ui/sync-banner";
import { useHistory } from "@/lib/hooks";
import { clearHistory, type HistoryItem } from "@/lib/tracking";

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export default function HistoryPage() {
  const { data, isPending } = useHistory();
  const ctx = useTrackCtx();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const h of data ?? []) {
      const k = dayLabel(h.watched_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(h);
    }
    return [...map.entries()];
  }, [data]);

  async function clear() {
    if (!confirm) return setConfirm(true);
    await clearHistory(ctx);
    setConfirm(false);
    void qc.invalidateQueries({ queryKey: ["history"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 pt-6 md:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">Watch History</h1>
        {data && data.length > 0 && (
          <button
            type="button"
            onClick={clear}
            onBlur={() => setConfirm(false)}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/10"
          >
            <Trash2 className="size-4" /> {confirm ? "Tap again to clear all" : "Clear history"}
          </button>
        )}
      </div>
      <SyncBanner />
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : !groups.length ? (
        <EmptyState icon={<HistoryIcon className="size-10" />} title="No history yet" message="Episodes you watch will show up here." />
      ) : (
        groups.map(([label, items]) => (
          <section key={label}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-dim">{label}</h2>
            <ul className="space-y-2">
              {items.map((h, i) => (
                <li key={h.id ?? `${h.anilist_id}-${h.episode}-${i}`}>
                  <Link
                    href={`/watch/${h.anilist_id}/${h.episode}`}
                    className="group flex items-center gap-4 rounded-xl bg-elev p-2.5 ring-1 ring-white/5 transition hover:bg-elev-2"
                  >
                    <div className="aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-elev-2">
                      {h.poster && <img src={h.poster} alt="" loading="lazy" className="size-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold group-hover:text-accent">{h.title ?? `Anime ${h.anilist_id}`}</p>
                      <p className="text-sm text-muted">Episode {h.episode}</p>
                    </div>
                    <span className="shrink-0 text-xs text-dim">
                      {new Date(h.watched_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
