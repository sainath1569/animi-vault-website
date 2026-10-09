import "server-only";
import { cached } from "./cache";
import type {
  AnimeCard,
  AnimeDetail,
  CharacterEdge,
  MediaFormat,
  MediaSeason,
  MediaStatus,
  PageInfo,
  ScheduleItem,
} from "./types";

const ENDPOINT = "https://graphql.anilist.co";

export class AniListError extends Error {}

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        const wait = Number(res.headers.get("Retry-After") || 2);
        lastErr = new AniListError("AniList rate limited");
        await new Promise((r) => setTimeout(r, Math.min(wait, 5) * 1000));
        continue;
      }
      const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
      if (json.errors?.length && !json.data) throw new AniListError(json.errors[0].message);
      if (!json.data) throw new AniListError(`AniList ${res.status}`);
      return json.data;
    } catch (err) {
      lastErr = err;
      if (err instanceof AniListError && !String(err.message).includes("rate")) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new AniListError("AniList unavailable");
}

// ── Fragments and mapping ────────────────────────────────

const CARD_FIELDS = `
  id idMal
  title { romaji english userPreferred }
  coverImage { large extraLarge color }
  bannerImage format status episodes duration averageScore seasonYear season genres
  description(asHtml: false)
  nextAiringEpisode { episode airingAt timeUntilAiring }
`;

interface RawCard {
  id: number;
  idMal: number | null;
  title: { romaji: string; english: string | null; userPreferred: string };
  coverImage: { large: string; extraLarge: string | null; color: string | null };
  bannerImage: string | null;
  format: MediaFormat | null;
  status: MediaStatus | null;
  episodes: number | null;
  duration: number | null;
  averageScore: number | null;
  seasonYear: number | null;
  season: MediaSeason | null;
  genres: string[];
  description: string | null;
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null;
}

export function cleanDescription(html: string | null) {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toCard(m: RawCard): AnimeCard {
  return {
    id: m.id,
    idMal: m.idMal,
    title: m.title.english || m.title.userPreferred || m.title.romaji,
    titleRomaji: m.title.romaji,
    cover: m.coverImage.extraLarge || m.coverImage.large,
    coverColor: m.coverImage.color,
    banner: m.bannerImage,
    format: m.format,
    status: m.status,
    episodes: m.episodes,
    duration: m.duration,
    score: m.averageScore,
    year: m.seasonYear,
    season: m.season,
    genres: m.genres ?? [],
    description: cleanDescription(m.description),
    nextAiring: m.nextAiringEpisode,
  };
}

const MIN = 60;
const HOUR = 3600;

// ── Home rows ────────────────────────────────────────────

export function currentSeason(date = new Date()): { season: MediaSeason; year: number } {
  const m = date.getUTCMonth();
  const year = date.getUTCFullYear();
  if (m <= 2) return { season: "WINTER", year };
  if (m <= 5) return { season: "SPRING", year };
  if (m <= 8) return { season: "SUMMER", year };
  return { season: "FALL", year };
}

export interface HomeData {
  trending: AnimeCard[];
  popularSeason: AnimeCard[];
  topRated: AnimeCard[];
  upcoming: AnimeCard[];
  allTimePopular: AnimeCard[];
  recentlyUpdated: AnimeCard[];
}

export function getHomeData(): Promise<HomeData> {
  const { season, year } = currentSeason();
  const now = Math.floor(Date.now() / 1000);
  // Round to 10 minutes so the cache key stays stable.
  const since = now - 2 * 86400 - (now % 600);
  return cached(`al:home:${season}:${year}`, 10 * MIN, async () => {
    const data = await gql<{
      trending: { media: RawCard[] };
      season: { media: RawCard[] };
      top: { media: RawCard[] };
      upcoming: { media: RawCard[] };
      popular: { media: RawCard[] };
      recent: { airingSchedules: { media: RawCard & { isAdult: boolean } }[] };
    }>(
      `query ($season: MediaSeason, $year: Int, $since: Int, $now: Int) {
        trending: Page(perPage: 20) { media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${CARD_FIELDS} } }
        season: Page(perPage: 20) { media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC, isAdult: false) { ${CARD_FIELDS} } }
        top: Page(perPage: 20) { media(type: ANIME, sort: SCORE_DESC, isAdult: false) { ${CARD_FIELDS} } }
        upcoming: Page(perPage: 20) { media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC, isAdult: false) { ${CARD_FIELDS} } }
        popular: Page(perPage: 20) { media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { ${CARD_FIELDS} } }
        recent: Page(perPage: 50) { airingSchedules(airingAt_greater: $since, airingAt_lesser: $now, sort: TIME_DESC) { media { isAdult ${CARD_FIELDS} } } }
      }`,
      { season, year, since, now },
    );
    const seen = new Set<number>();
    const recentlyUpdated = data.recent.airingSchedules
      .map((s) => s.media)
      .filter((m) => m && !m.isAdult && !seen.has(m.id) && seen.add(m.id))
      .slice(0, 20)
      .map(toCard);
    return {
      trending: data.trending.media.map(toCard),
      popularSeason: data.season.media.map(toCard),
      topRated: data.top.media.map(toCard),
      upcoming: data.upcoming.media.map(toCard),
      allTimePopular: data.popular.media.map(toCard),
      recentlyUpdated,
    };
  });
}

// ── Search / browse ──────────────────────────────────────

export type SortKey = "TRENDING_DESC" | "POPULARITY_DESC" | "SCORE_DESC" | "START_DATE_DESC" | "FAVOURITES_DESC" | "TITLE_ROMAJI";

export interface BrowseFilters {
  search?: string;
  genres?: string[];
  season?: MediaSeason;
  year?: number;
  status?: MediaStatus;
  format?: MediaFormat;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}

export function browse(f: BrowseFilters): Promise<{ items: AnimeCard[]; pageInfo: PageInfo }> {
  const vars = {
    search: f.search?.trim() || undefined,
    genres: f.genres?.length ? f.genres : undefined,
    season: f.season,
    year: f.year,
    status: f.status,
    format: f.format,
    sort: [f.sort ?? (f.search ? "SEARCH_MATCH" : "POPULARITY_DESC")],
    page: f.page ?? 1,
    perPage: f.perPage ?? 30,
  };
  return cached(`al:browse:${JSON.stringify(vars)}`, f.search ? 5 * MIN : 30 * MIN, async () => {
    const data = await gql<{
      Page: { pageInfo: { currentPage: number; hasNextPage: boolean; total: number }; media: RawCard[] };
    }>(
      `query ($search: String, $genres: [String], $season: MediaSeason, $year: Int, $status: MediaStatus,
              $format: MediaFormat, $sort: [MediaSort], $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { currentPage hasNextPage total }
          media(type: ANIME, isAdult: false, search: $search, genre_in: $genres, season: $season,
                seasonYear: $year, status: $status, format: $format, sort: $sort) { ${CARD_FIELDS} }
        }
      }`,
      vars,
    );
    return { items: data.Page.media.map(toCard), pageInfo: data.Page.pageInfo };
  });
}

export function getGenres(): Promise<string[]> {
  return cached("al:genres", 24 * HOUR, async () => {
    const data = await gql<{ GenreCollection: string[] }>(`query { GenreCollection }`);
    return data.GenreCollection.filter((g) => g !== "Hentai");
  });
}

export function getByIds(ids: number[]): Promise<AnimeCard[]> {
  if (!ids.length) return Promise.resolve([]);
  const key = [...ids].sort((a, b) => a - b).join(",");
  return cached(`al:ids:${key}`, HOUR, async () => {
    const data = await gql<{ Page: { media: RawCard[] } }>(
      `query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { ${CARD_FIELDS} } } }`,
      { ids: ids.slice(0, 50) },
    );
    const byId = new Map(data.Page.media.map((m) => [m.id, toCard(m)]));
    return ids.map((id) => byId.get(id)).filter((x): x is AnimeCard => Boolean(x));
  });
}

// ── Detail ───────────────────────────────────────────────

interface RawDetail extends RawCard {
  title: RawCard["title"] & { native: string | null };
  synonyms: string[];
  source: string | null;
  popularity: number | null;
  favourites: number | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  endDate: { year: number | null; month: number | null; day: number | null };
  trailer: { id: string; site: string } | null;
  studios: { nodes: { name: string; isAnimationStudio: boolean }[] };
  tags: { name: string; rank: number; isMediaSpoiler: boolean }[];
  rankings: { rank: number; type: string; allTime: boolean; context: string; year: number | null }[];
  externalLinks: { site: string; url: string; type: string | null; icon: string | null; color: string | null }[];
  characters: {
    edges: {
      role: CharacterEdge["role"];
      node: { id: number; name: { full: string }; image: { large: string | null } };
      voiceActors: { id: number; name: { full: string }; image: { large: string | null }; languageV2: string }[];
    }[];
  };
  relations: { edges: { relationType: string; node: RawCard & { type: string } }[] };
  recommendations: { nodes: { mediaRecommendation: RawCard | null }[] };
}

function fmtDate(d: { year: number | null; month: number | null; day: number | null }) {
  if (!d?.year) return null;
  return [d.year, d.month, d.day]
    .filter(Boolean)
    .map((n, i) => (i === 0 ? String(n) : String(n).padStart(2, "0")))
    .join("-");
}

export function getAnime(id: number): Promise<AnimeDetail | null> {
  return cached(`al:anime:${id}`, 6 * HOUR, async () => {
    const data = await gql<{ Media: RawDetail | null }>(
      `query ($id: Int) {
        Media(id: $id, type: ANIME) {
          ${CARD_FIELDS}
          title { native }
          synonyms source popularity favourites
          startDate { year month day } endDate { year month day }
          trailer { id site }
          studios(isMain: true) { nodes { name isAnimationStudio } }
          tags { name rank isMediaSpoiler }
          rankings { rank type allTime context year }
          externalLinks { site url type icon color }
          characters(sort: [ROLE, RELEVANCE], perPage: 18) {
            edges { role node { id name { full } image { large } }
              voiceActors(language: JAPANESE, sort: RELEVANCE) { id name { full } image { large } languageV2 } }
          }
          relations { edges { relationType node { type ${CARD_FIELDS} } } }
          recommendations(sort: RATING_DESC, perPage: 16) { nodes { mediaRecommendation { ${CARD_FIELDS} } } }
        }
      }`,
      { id },
    ).catch((err) => {
      if (err instanceof AniListError && /not found/i.test(err.message)) return { Media: null };
      throw err;
    });
    const m = data.Media;
    if (!m) return null;
    return {
      ...toCard(m),
      titleEnglish: m.title.english,
      titleNative: m.title.native,
      synonyms: m.synonyms ?? [],
      studios: m.studios.nodes.map((s) => s.name),
      source: m.source,
      popularity: m.popularity,
      favourites: m.favourites,
      startDate: fmtDate(m.startDate),
      endDate: fmtDate(m.endDate),
      trailer: m.trailer,
      tags: m.tags.filter((t) => !t.isMediaSpoiler && t.rank >= 60).map((t) => t.name).slice(0, 8),
      rankings: m.rankings ?? [],
      externalLinks: (m.externalLinks ?? [])
        .filter((l) => l.type === "STREAMING" || l.type === "INFO")
        .filter((l, i, all) => all.findIndex((x) => x.site === l.site && x.type === l.type) === i),
      characters: m.characters.edges.map((e) => ({
        id: e.node.id,
        name: e.node.name.full,
        image: e.node.image.large,
        role: e.role,
        voiceActor: e.voiceActors[0]
          ? {
              id: e.voiceActors[0].id,
              name: e.voiceActors[0].name.full,
              image: e.voiceActors[0].image.large,
              language: e.voiceActors[0].languageV2,
            }
          : null,
      })),
      relations: m.relations.edges
        .filter((e) => e.node.type === "ANIME")
        .map((e) => ({ relationType: e.relationType, anime: toCard(e.node) })),
      recommendations: m.recommendations.nodes
        .map((n) => n.mediaRecommendation)
        .filter((x): x is RawCard => Boolean(x))
        .map(toCard),
    };
  });
}

export function getRecommendations(id: number): Promise<AnimeCard[]> {
  return cached(`al:recs:${id}`, 12 * HOUR, async () => {
    const data = await gql<{ Media: { recommendations: { nodes: { mediaRecommendation: RawCard | null }[] } } | null }>(
      `query ($id: Int) { Media(id: $id, type: ANIME) {
        recommendations(sort: RATING_DESC, perPage: 20) { nodes { mediaRecommendation { ${CARD_FIELDS} } } } } }`,
      { id },
    );
    return (data.Media?.recommendations.nodes ?? [])
      .map((n) => n.mediaRecommendation)
      .filter((x): x is RawCard => Boolean(x))
      .map(toCard);
  });
}

// ── Schedule ─────────────────────────────────────────────

/** Episodes airing between `from` and `to` (unix seconds), sorted by time. */
export function getSchedule(from: number, to: number): Promise<ScheduleItem[]> {
  const f = from - (from % 300);
  return cached(`al:sched:${f}:${to - (to % 300)}`, 5 * MIN, async () => {
    const items: ScheduleItem[] = [];
    for (let page = 1; page <= 6; page++) {
      const data = await gql<{
        Page: {
          pageInfo: { hasNextPage: boolean };
          airingSchedules: { id: number; episode: number; airingAt: number; media: RawCard & { isAdult: boolean } }[];
        };
      }>(
        `query ($from: Int, $to: Int, $page: Int) {
          Page(page: $page, perPage: 50) {
            pageInfo { hasNextPage }
            airingSchedules(airingAt_greater: $from, airingAt_lesser: $to, sort: TIME) {
              id episode airingAt media { isAdult ${CARD_FIELDS} }
            }
          }
        }`,
        { from, to, page },
      );
      for (const s of data.Page.airingSchedules) {
        if (s.media && !s.media.isAdult) {
          items.push({ id: s.id, episode: s.episode, airingAt: s.airingAt, anime: toCard(s.media) });
        }
      }
      if (!data.Page.pageInfo.hasNextPage) break;
    }
    return items;
  });
}
