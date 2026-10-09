"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AnimeCard } from "@/lib/types";
import { cn, formatLabel } from "@/lib/utils";

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const term = useDebounced(q.trim(), 300);

  const { data, isFetching } = useQuery({
    queryKey: ["autocomplete", term],
    queryFn: async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&limit=8`);
      if (!res.ok) throw new Error("search failed");
      return ((await res.json()) as { items: AnimeCard[] }).items;
    },
    enabled: term.length >= 2,
    staleTime: 5 * 60_000,
  });

  // Close and clear on navigation (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setQ("");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    }
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const results = term.length >= 2 ? (data ?? []) : [];

  function submit() {
    if (active >= 0 && results[active]) {
      router.push(`/anime/${results[active].id}`);
    } else if (q.trim()) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative">
      <div
        className={cn(
          "flex h-10 items-center gap-2 rounded-full border transition-all duration-200",
          open ? "w-[min(78vw,340px)] border-line bg-elev px-3" : "w-10 justify-center border-transparent",
        )}
      >
        <button
          type="button"
          aria-label="Search"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="shrink-0 text-muted hover:text-fg"
        >
          <Search className="size-5" />
        </button>
        {open && (
          <>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(-1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                else if (e.key === "Escape") setOpen(false);
                else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, -1));
                }
              }}
              placeholder="Search anime…"
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
              aria-label="Search anime"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="search-results"
            />
            {isFetching ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-dim" />
            ) : q ? (
              <button type="button" aria-label="Clear" onClick={() => setQ("")} className="text-dim hover:text-fg">
                <X className="size-4" />
              </button>
            ) : null}
          </>
        )}
      </div>

      {open && term.length >= 2 && (
        <div
          id="search-results"
          role="listbox"
          className="fade-in absolute right-0 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-line bg-elev shadow-2xl shadow-black/60"
        >
          {results.length === 0 && !isFetching && <p className="p-4 text-sm text-muted">No results for “{term}”.</p>}
          {results.map((a, i) => (
            <Link
              key={a.id}
              href={`/anime/${a.id}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              className={cn("flex gap-3 p-2.5 transition-colors", i === active && "bg-elev-2")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.cover} alt="" className="h-16 w-11 shrink-0 rounded object-cover" loading="lazy" />
              <div className="min-w-0 py-0.5">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <p className="mt-1 text-xs text-dim">
                  {[formatLabel(a.format), a.year, a.episodes ? `${a.episodes} eps` : null].filter(Boolean).join(" · ")}
                </p>
              </div>
            </Link>
          ))}
          {results.length > 0 && (
            <button
              type="button"
              onClick={submit}
              className="w-full border-t border-line px-4 py-2.5 text-left text-sm text-accent hover:bg-elev-2"
            >
              See all results for “{term}”
            </button>
          )}
        </div>
      )}
    </div>
  );
}
