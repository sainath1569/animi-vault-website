/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { browse, type BrowseFilters } from "@/lib/anilist";
import { getOverrides, withoutHidden } from "@/lib/content";
import { cn, formatLabel, statusLabel, toInt } from "@/lib/utils";

export const metadata: Metadata = { title: "Top Anime" };

const TABS: { id: string; label: string; filters: BrowseFilters }[] = [
  { id: "all", label: "All Time", filters: { sort: "SCORE_DESC" } },
  { id: "airing", label: "Airing", filters: { sort: "SCORE_DESC", status: "RELEASING" } },
  { id: "movies", label: "Movies", filters: { sort: "SCORE_DESC", format: "MOVIE" } },
  { id: "popular", label: "Most Popular", filters: { sort: "POPULARITY_DESC" } },
];
const PER_PAGE = 50;

export default async function TopPage({ searchParams }: PageProps<"/top">) {
  const sp = await searchParams;
  const tabId = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "all";
  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];
  const page = Math.max(1, Math.min(20, toInt(sp.page as string | undefined, 1)!));
  const [{ items, pageInfo }, overrides] = await Promise.all([
    browse({ ...tab.filters, page, perPage: PER_PAGE }),
    getOverrides(),
  ]);
  const list = withoutHidden(items, overrides);
  const start = (page - 1) * PER_PAGE;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">Top Anime</h1>
      <nav className="mt-5 flex gap-1 overflow-x-auto no-scrollbar" aria-label="Rankings">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/top?tab=${t.id}`}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              t.id === tab.id ? "bg-accent text-white" : "bg-elev text-muted hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <ol className="mt-6 space-y-2">
        {list.map((a, i) => (
          <li key={a.id}>
            <Link
              href={`/anime/${a.id}`}
              prefetch={false}
              className="group flex items-center gap-4 rounded-xl bg-elev p-2.5 ring-1 ring-white/5 transition hover:bg-elev-2 hover:ring-accent/40"
            >
              <span
                className={cn(
                  "w-10 shrink-0 text-center font-[family-name:var(--font-display)] text-2xl font-extrabold tabular-nums",
                  start + i < 3 ? "text-accent" : "text-dim",
                )}
              >
                {start + i + 1}
              </span>
              <img src={a.cover} alt="" loading="lazy" className="h-20 w-14 shrink-0 rounded-md object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold group-hover:text-accent">{a.title}</p>
                <p className="mt-0.5 text-xs text-dim">
                  {[formatLabel(a.format), a.year, a.episodes ? `${a.episodes} eps` : null, statusLabel(a.status)].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1.5 hidden truncate text-xs text-muted sm:block">{a.genres.slice(0, 4).join(", ")}</p>
              </div>
              {a.score ? (
                <span className="flex shrink-0 items-center gap-1 pr-2 text-sm font-bold">
                  <Star className="size-4 fill-warn text-warn" /> {(a.score / 10).toFixed(1)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ol>

      <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Pagination">
        {page > 1 && (
          <Link href={`/top?tab=${tab.id}&page=${page - 1}`} className="flex items-center gap-1 rounded-full bg-elev-2 px-4 py-2 text-sm font-semibold hover:bg-white/15">
            <ChevronLeft className="size-4" /> Previous
          </Link>
        )}
        <span className="text-sm text-muted">Page {page}</span>
        {pageInfo.hasNextPage && page < 20 && (
          <Link href={`/top?tab=${tab.id}&page=${page + 1}`} className="flex items-center gap-1 rounded-full bg-elev-2 px-4 py-2 text-sm font-semibold hover:bg-white/15">
            Next <ChevronRight className="size-4" />
          </Link>
        )}
      </nav>
    </div>
  );
}
