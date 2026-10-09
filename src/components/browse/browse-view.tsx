import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AnimeGrid } from "../anime/anime-grid";
import { BrowseFilters } from "./filters";
import { browse, getGenres, type SortKey } from "@/lib/anilist";
import { getOverrides, withoutHidden } from "@/lib/content";
import type { MediaFormat, MediaSeason, MediaStatus } from "@/lib/types";
import { toInt } from "@/lib/utils";

type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const SEASONS = new Set(["WINTER", "SPRING", "SUMMER", "FALL"]);
const STATUSES = new Set(["RELEASING", "FINISHED", "NOT_YET_RELEASED", "CANCELLED", "HIATUS"]);
const FORMATS = new Set(["TV", "TV_SHORT", "MOVIE", "SPECIAL", "OVA", "ONA", "MUSIC"]);
const SORTS = new Set(["TRENDING_DESC", "POPULARITY_DESC", "SCORE_DESC", "START_DATE_DESC", "FAVOURITES_DESC", "TITLE_ROMAJI"]);

export async function BrowseView({ searchParams, title }: { searchParams: SP; title: string }) {
  const q = one(searchParams.q)?.slice(0, 80);
  const season = one(searchParams.season);
  const status = one(searchParams.status);
  const format = one(searchParams.format);
  const sort = one(searchParams.sort);
  const year = toInt(one(searchParams.year));
  const page = Math.max(1, Math.min(200, toInt(one(searchParams.page), 1)!));

  const [result, genres, overrides] = await Promise.all([
    browse({
      search: q,
      genres: many(searchParams.genre).slice(0, 8),
      season: season && SEASONS.has(season) ? (season as MediaSeason) : undefined,
      status: status && STATUSES.has(status) ? (status as MediaStatus) : undefined,
      format: format && FORMATS.has(format) ? (format as MediaFormat) : undefined,
      sort: sort && SORTS.has(sort) ? (sort as SortKey) : undefined,
      year: year && year > 1900 && year < 2100 ? year : undefined,
      page,
      perPage: 30,
    }),
    getGenres().catch(() => [] as string[]),
    getOverrides(),
  ]);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) for (const x of many(v)) next.append(k, x);
    next.set("page", String(p));
    return `?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">
        {q ? <>Results for “{q}”</> : title}
      </h1>
      <div className="mt-5">
        <Suspense>
          <BrowseFilters genres={genres} maxYear={new Date().getFullYear() + 1} />
        </Suspense>
      </div>
      <div className="mt-8">
        <AnimeGrid items={withoutHidden(result.items, overrides)} />
      </div>
      {(page > 1 || result.pageInfo.hasNextPage) && (
        <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="flex items-center gap-1 rounded-full bg-elev-2 px-4 py-2 text-sm font-semibold hover:bg-white/15">
              <ChevronLeft className="size-4" /> Previous
            </Link>
          ) : null}
          <span className="text-sm text-muted">Page {page}</span>
          {result.pageInfo.hasNextPage ? (
            <Link href={pageHref(page + 1)} className="flex items-center gap-1 rounded-full bg-elev-2 px-4 py-2 text-sm font-semibold hover:bg-white/15">
              Next <ChevronRight className="size-4" />
            </Link>
          ) : null}
        </nav>
      )}
    </div>
  );
}
