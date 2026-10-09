import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { browse, currentSeason } from "@/lib/anilist";
import { getOverrides, withoutHidden } from "@/lib/content";
import type { AnimeCard, MediaSeason } from "@/lib/types";
import { cn, seasonLabel, toInt } from "@/lib/utils";

export const metadata: Metadata = { title: "Seasonal Anime" };

const SEASONS: MediaSeason[] = ["WINTER", "SPRING", "SUMMER", "FALL"];
const GROUPS: { label: string; formats: string[] }[] = [
  { label: "TV Series", formats: ["TV"] },
  { label: "Movies", formats: ["MOVIE"] },
  { label: "ONA / OVA / Specials", formats: ["ONA", "OVA", "SPECIAL", "TV_SHORT", "MUSIC"] },
];

export default async function SeasonalPage({ searchParams }: PageProps<"/seasonal">) {
  const sp = await searchParams;
  const now = currentSeason();
  const seasonParam = (Array.isArray(sp.season) ? sp.season[0] : sp.season)?.toUpperCase();
  const season = SEASONS.includes(seasonParam as MediaSeason) ? (seasonParam as MediaSeason) : now.season;
  const yearRaw = toInt(sp.year as string | undefined, now.year)!;
  const year = Math.min(now.year + 1, Math.max(1960, yearRaw));

  const [p1, p2, overrides] = await Promise.all([
    browse({ season, year, sort: "POPULARITY_DESC", perPage: 50, page: 1 }),
    browse({ season, year, sort: "POPULARITY_DESC", perPage: 50, page: 2 }).catch(() => ({ items: [] as AnimeCard[] })),
    getOverrides(),
  ]);
  const items = withoutHidden([...p1.items, ...p2.items], overrides);

  const idx = SEASONS.indexOf(season);
  const prev = idx === 0 ? { s: "FALL", y: year - 1 } : { s: SEASONS[idx - 1], y: year };
  const next = idx === 3 ? { s: "WINTER", y: year + 1 } : { s: SEASONS[idx + 1], y: year };
  const href = (s: string, y: number) => `/seasonal?season=${s}&year=${y}`;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">
          {seasonLabel(season)} {year}
        </h1>
        <div className="flex items-center gap-2">
          <Link href={href(prev.s, prev.y)} aria-label="Previous season" className="rounded-full bg-elev-2 p-2 hover:bg-white/15">
            <ChevronLeft className="size-5" />
          </Link>
          <form action="/seasonal" className="flex items-center gap-2">
            <input type="hidden" name="season" value={season} />
            <select name="year" defaultValue={year} className="h-9 rounded-lg border border-line bg-elev px-2 text-sm" aria-label="Year">
              {Array.from({ length: now.year + 2 - 1960 }, (_, i) => now.year + 1 - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button type="submit" className="h-9 rounded-lg bg-elev-2 px-3 text-sm font-semibold hover:bg-white/15">
              Go
            </button>
          </form>
          <Link href={href(next.s, next.y)} aria-label="Next season" className="rounded-full bg-elev-2 p-2 hover:bg-white/15">
            <ChevronRight className="size-5" />
          </Link>
        </div>
      </div>

      <nav className="mt-5 flex gap-1 overflow-x-auto no-scrollbar" aria-label="Seasons">
        {SEASONS.map((s) => (
          <Link
            key={s}
            href={href(s, year)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
              s === season ? "bg-accent text-white" : "bg-elev text-muted hover:text-fg",
            )}
          >
            {seasonLabel(s)}
          </Link>
        ))}
      </nav>

      <div className="mt-8 space-y-12">
        {GROUPS.map((g) => {
          const list = items.filter((a) => a.format && g.formats.includes(a.format));
          if (!list.length) return null;
          return (
            <section key={g.label}>
              <h2 className="mb-4 text-lg font-bold">
                {g.label} <span className="text-sm font-normal text-dim">({list.length})</span>
              </h2>
              <AnimeGrid items={list} />
            </section>
          );
        })}
        {!items.length && <p className="py-16 text-center text-muted">No anime found for this season yet.</p>}
      </div>
    </div>
  );
}
