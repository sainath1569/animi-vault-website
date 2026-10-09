"use client";

/* eslint-disable @next/next/no-img-element */
import { Heart, ListVideo, Pencil, Star, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { STATUS_OPTIONS } from "@/components/anime/detail-actions";
import { EmptyState } from "@/components/ui/error-state";
import { SyncBanner } from "@/components/ui/sync-banner";
import { useFavorites, useList, useRemoveEntry, useUpsertEntry } from "@/lib/hooks";
import type { ListEntry, ListStatus } from "@/lib/types";
import { cn, formatLabel } from "@/lib/utils";

const TABS = [{ value: "all", label: "All" }, ...STATUS_OPTIONS, { value: "favorites", label: "Favorites" }] as const;
type Tab = (typeof TABS)[number]["value"];
type Sort = "updated" | "title" | "score" | "progress";

export function ListView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.find((t) => t.value === params.get("status"))?.value ?? "all") as Tab;
  const [sort, setSort] = useState<Sort>("updated");
  const [editing, setEditing] = useState<ListEntry | null>(null);
  const { data: list, isPending } = useList();
  const { data: favs } = useFavorites();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list?.length ?? 0, favorites: favs?.length ?? 0 };
    for (const e of list ?? []) c[e.status] = (c[e.status] ?? 0) + 1;
    return c;
  }, [list, favs]);

  const entries = useMemo(() => {
    const filtered = (list ?? []).filter((e) => tab === "all" || e.status === tab);
    return [...filtered].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "score") return (b.score ?? 0) - (a.score ?? 0);
      if (sort === "progress") return b.progress - a.progress;
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [list, tab, sort]);

  const setTab = (t: Tab) => router.replace(t === "all" ? pathname : `${pathname}?status=${t}`, { scroll: false });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 pt-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">My List</h1>
        {tab !== "favorites" && (
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-9 rounded-lg border border-line bg-elev px-3 text-sm"
            aria-label="Sort"
          >
            <option value="updated">Recently updated</option>
            <option value="title">Title</option>
            <option value="score">Your score</option>
            <option value="progress">Progress</option>
          </select>
        )}
      </div>
      <SyncBanner />
      <nav className="no-scrollbar flex gap-1 overflow-x-auto" aria-label="List status">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              tab === t.value ? "bg-accent text-white" : "bg-elev text-muted hover:text-fg",
            )}
          >
            {t.label} <span className="ml-1 opacity-70">{counts[t.value] ?? 0}</span>
          </button>
        ))}
      </nav>

      {isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="skeleton aspect-[2/3] rounded-lg" />
          ))}
        </div>
      ) : tab === "favorites" ? (
        favs?.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {favs.map((f) => (
              <Link key={f.anilist_id} href={`/anime/${f.anilist_id}`} className="group">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-elev ring-1 ring-white/5 group-hover:ring-accent/60">
                  {f.poster && <img src={f.poster} alt="" loading="lazy" className="size-full object-cover" />}
                  <Heart className="absolute right-2 top-2 size-5 fill-accent text-accent drop-shadow" />
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] font-medium">{f.title}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Heart className="size-10" />} title="No favorites yet" message="Tap the heart on any anime to save it here." />
        )
      ) : entries.length ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
          {entries.map((e) => (
            <div key={e.anilist_id} className="group relative">
              <Link href={`/anime/${e.anilist_id}`} className="block">
                <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-elev ring-1 ring-white/5 group-hover:ring-accent/60">
                  {e.poster && <img src={e.poster} alt="" loading="lazy" className="size-full object-cover" />}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>
                        {e.progress}/{e.episodes_total ?? "?"} eps
                      </span>
                      {e.score ? (
                        <span className="flex items-center gap-0.5">
                          <Star className="size-3 fill-warn text-warn" /> {e.score}
                        </span>
                      ) : null}
                    </div>
                    {e.episodes_total ? (
                      <div className="mt-1.5 h-1 rounded-full bg-white/20">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (e.progress / e.episodes_total) * 100)}%` }} />
                      </div>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-[13px] font-medium">{e.title}</p>
                <p className="text-xs text-dim">
                  {tab === "all" ? STATUS_OPTIONS.find((s) => s.value === e.status)?.label : formatLabel(e.format)}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => setEditing(e)}
                aria-label={`Edit ${e.title}`}
                className="absolute right-2 top-2 rounded-full bg-black/75 p-2 opacity-100 transition-opacity hover:bg-black md:opacity-0 md:group-hover:opacity-100"
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ListVideo className="size-10" />}
          title="Nothing here yet"
          message="Add anime from any detail page, or just start watching. Shows move to Watching automatically."
          action={
            <Link href="/browse" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
              Browse anime
            </Link>
          }
        />
      )}

      {editing && <EditEntry entry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditEntry({ entry, onClose }: { entry: ListEntry; onClose: () => void }) {
  const upsert = useUpsertEntry();
  const remove = useRemoveEntry();
  const [status, setStatus] = useState<ListStatus>(entry.status);
  const [progress, setProgress] = useState(entry.progress);
  const [score, setScore] = useState<number | null>(entry.score);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const max = entry.episodes_total ?? 9999;

  async function save() {
    await upsert.mutateAsync({
      anilist_id: entry.anilist_id,
      title: entry.title,
      status,
      progress: Math.max(0, Math.min(max, progress)),
      score,
      notes: notes.trim() || null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${entry.title}`}
        className="fade-in w-full max-w-md rounded-2xl border border-line bg-elev p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold leading-snug">{entry.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-fg">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as ListStatus)} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm">
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Episodes watched</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm"
                />
                <span className="shrink-0 text-sm text-dim">/ {entry.episodes_total ?? "?"}</span>
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Score</span>
              <select
                value={score ?? ""}
                onChange={(e) => setScore(e.target.value ? Number(e.target.value) : null)}
                className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm"
              >
                <option value="">No score</option>
                {Array.from({ length: 10 }, (_, i) => 10 - i).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={3}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              if (!confirmRemove) return setConfirmRemove(true);
              await remove.mutateAsync(entry.anilist_id);
              onClose();
            }}
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10"
          >
            {confirmRemove ? "Tap again to remove" : "Remove"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={upsert.isPending}
            className="ml-auto rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
