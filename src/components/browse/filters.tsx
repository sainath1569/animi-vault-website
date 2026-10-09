"use client";

import { Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

const SEASONS = ["WINTER", "SPRING", "SUMMER", "FALL"];
const STATUSES = [
  ["RELEASING", "Airing"],
  ["FINISHED", "Finished"],
  ["NOT_YET_RELEASED", "Upcoming"],
];
const FORMATS = [
  ["TV", "TV"],
  ["MOVIE", "Movie"],
  ["OVA", "OVA"],
  ["ONA", "ONA"],
  ["SPECIAL", "Special"],
  ["TV_SHORT", "TV Short"],
];
const SORTS = [
  ["POPULARITY_DESC", "Popularity"],
  ["TRENDING_DESC", "Trending"],
  ["SCORE_DESC", "Score"],
  ["START_DATE_DESC", "Newest"],
  ["FAVOURITES_DESC", "Favorites"],
  ["TITLE_ROMAJI", "Title"],
];

export function BrowseFilters({ genres, maxYear }: { genres: string[]; maxYear: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const selectedGenres = params.getAll("genre");

  const urlQ = params.get("q") ?? "";
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setQ(urlQ);
  }

  function update(mut: (p: URLSearchParams) => void) {
    const next = new URLSearchParams(params.toString());
    mut(next);
    next.delete("page");
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function set(key: string, value: string | null) {
    update((p) => (value ? p.set(key, value) : p.delete(key)));
  }

  function toggleGenre(g: string) {
    update((p) => {
      const cur = p.getAll("genre");
      p.delete("genre");
      for (const x of cur.includes(g) ? cur.filter((c) => c !== g) : [...cur, g]) p.append("genre", x);
    });
  }

  const years = Array.from({ length: maxYear - 1959 }, (_, i) => String(maxYear - i));
  const activeCount = ["season", "year", "status", "format"].filter((k) => params.get(k)).length + selectedGenres.length;

  return (
    <div className={cn("space-y-3 transition-opacity", pending && "opacity-60")}>
      <div className="flex flex-wrap gap-2">
        <form
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-elev px-3 focus-within:border-accent sm:max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            set("q", q.trim() || null);
          }}
        >
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles…"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
            aria-label="Search titles"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ("");
                set("q", null);
              }}
            >
              <X className="size-4 text-dim hover:text-fg" />
            </button>
          )}
        </form>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 items-center gap-2 rounded-lg border border-line bg-elev px-3 text-sm md:hidden"
          aria-expanded={open}
        >
          <SlidersHorizontal className="size-4" /> Filters {activeCount > 0 && <span className="rounded-full bg-accent px-1.5 text-xs">{activeCount}</span>}
        </button>
        <Select label="Sort" value={params.get("sort") ?? ""} onChange={(v) => set("sort", v || null)} options={SORTS} placeholder={params.get("q") ? "Relevance" : "Popularity"} />
      </div>

      <div className={cn("flex-wrap gap-2", open ? "flex" : "hidden md:flex")}>
        <GenrePicker genres={genres} selected={selectedGenres} onToggle={toggleGenre} />
        <Select label="Season" value={params.get("season") ?? ""} onChange={(v) => set("season", v || null)} options={SEASONS.map((s) => [s, s[0] + s.slice(1).toLowerCase()])} placeholder="Any season" />
        <Select label="Year" value={params.get("year") ?? ""} onChange={(v) => set("year", v || null)} options={years.map((y) => [y, y])} placeholder="Any year" />
        <Select label="Status" value={params.get("status") ?? ""} onChange={(v) => set("status", v || null)} options={STATUSES} placeholder="Any status" />
        <Select label="Format" value={params.get("format") ?? ""} onChange={(v) => set("format", v || null)} options={FORMATS} placeholder="Any format" />
        {(activeCount > 0 || params.get("q")) && (
          <button
            type="button"
            onClick={() => startTransition(() => router.push(pathname))}
            className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-muted hover:text-fg"
          >
            <X className="size-4" /> Clear all
          </button>
        )}
      </div>

      {selectedGenres.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedGenres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => toggleGenre(g)}
              className="flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-fg ring-1 ring-accent/40 hover:bg-accent/25"
            >
              {g} <X className="size-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[][];
  placeholder: string;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 appearance-none rounded-lg border bg-elev pl-3 pr-9 text-sm outline-none focus:border-accent",
          value ? "border-accent/60 text-fg" : "border-line text-muted",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-dim" />
    </label>
  );
}

function GenrePicker({ genres, selected, onToggle }: { genres: string[]; selected: string[]; onToggle: (g: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex h-10 items-center gap-2 rounded-lg border bg-elev px-3 text-sm",
          selected.length ? "border-accent/60 text-fg" : "border-line text-muted",
        )}
      >
        {selected.length ? `Genres (${selected.length})` : "Any genre"}
        <ChevronDown className="size-4 text-dim" />
      </button>
      {open && (
        <div className="fade-in absolute left-0 z-30 mt-2 grid w-[min(90vw,420px)] grid-cols-2 gap-1 rounded-xl border border-line bg-elev p-2 shadow-2xl shadow-black/60 sm:grid-cols-3">
          {genres.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onToggle(g)}
              className={cn(
                "flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-elev-2",
                selected.includes(g) && "text-accent",
              )}
            >
              {g}
              {selected.includes(g) && <Check className="size-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
