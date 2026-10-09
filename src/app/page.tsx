import { HeroCarousel } from "@/components/anime/hero-carousel";
import { Row } from "@/components/anime/anime-row";
import { AnimeCard } from "@/components/anime/anime-card";
import { PersonalRows } from "@/components/home/personal-rows";
import { getByIds, getHomeData, currentSeason } from "@/lib/anilist";
import { getOverrides, withoutHidden } from "@/lib/content";
import { seasonLabel } from "@/lib/utils";

// Rendered per request from the in-memory cache, so builds never depend on AniList being up.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Errors go to error.tsx rather than caching an empty page.
  const [home, overrides] = await Promise.all([getHomeData(), getOverrides()]);

  const featured = overrides.featured.length ? await getByIds(overrides.featured).catch(() => []) : [];
  const seen = new Set<number>();
  const hero = withoutHidden([...featured, ...home.trending.filter((a) => a.banner)], overrides)
    .filter((a) => !seen.has(a.id) && seen.add(a.id))
    .slice(0, 8);
  const clean = (list: typeof home.trending) => withoutHidden(list, overrides);
  const { season, year } = currentSeason();

  const rows = [
    { title: "Trending Now", href: "/browse?sort=TRENDING_DESC", items: clean(home.trending) },
    { title: `Popular in ${seasonLabel(season)} ${year}`, href: "/seasonal", items: clean(home.popularSeason) },
    { title: "Recently Updated", href: "/schedule", items: clean(home.recentlyUpdated) },
  ];
  const lower = [
    { title: "Top Rated", href: "/top", items: clean(home.topRated), ranked: true },
    { title: "Upcoming", href: "/browse?status=NOT_YET_RELEASED", items: clean(home.upcoming) },
    { title: "All-Time Popular", href: "/browse?sort=POPULARITY_DESC", items: clean(home.allTimePopular) },
  ];

  return (
    <div className="pb-8">
      <HeroCarousel items={hero} />
      <div className="relative z-10 -mt-8 space-y-10 md:-mt-14">
        <PersonalRows position="top" />
        {rows.map((r) => (
          <Row key={r.title} title={r.title} href={r.href}>
            {r.items.map((a, i) => (
              <AnimeCard key={a.id} anime={a} priority={i < 4} />
            ))}
          </Row>
        ))}
        <PersonalRows position="middle" />
        {lower.map((r) => (
          <Row key={r.title} title={r.title} href={r.href}>
            {r.items.map((a, i) => (
              <AnimeCard key={a.id} anime={a} rank={r.ranked ? i + 1 : undefined} />
            ))}
          </Row>
        ))}
      </div>
    </div>
  );
}
