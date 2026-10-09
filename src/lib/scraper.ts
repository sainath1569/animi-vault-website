import "server-only";
import { cached } from "./cache";
import { SCRAPER_BASE_URL } from "./env";
import type {
  AnimeArt,
  EpisodeItem,
  EpisodeMeta,
  ScraperEpisode,
  StreamSource,
  StreamType,
  Theme,
  WatchData,
} from "./types";

export class ScraperError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | undefined | null>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(path, SCRAPER_BASE_URL + "/");
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function request<T>(path: string, query?: Query, timeoutMs = 25000): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.SCRAPER_API_KEY) headers["x-api-key"] = process.env.SCRAPER_API_KEY;

  let lastErr: unknown;
  // One retry for transient failures (timeouts, 5xx, 429).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(buildUrl(path, query), {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
      if (!res.ok || !body || (typeof body === "object" && "error" in body && body.error)) {
        const msg = (body && body.error) || `Scraper ${res.status} on ${path}`;
        const err = new ScraperError(msg, res.status);
        if (res.status === 429 || res.status >= 500) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
          continue;
        }
        throw err;
      }
      return body;
    } catch (err) {
      if (err instanceof ScraperError && err.status < 500 && err.status !== 429) throw err;
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new ScraperError("Scraper unavailable", 503);
}

const MIN = 60;
const HOUR = 3600;

// ── Streaming ────────────────────────────────────────────

export function getSourceEpisodes(anilistId: number, source?: StreamSource) {
  return cached(`scr:eps:${anilistId}:${source ?? ""}`, HOUR, () =>
    request<{ count: number; source: string; episodes: ScraperEpisode[] }>("/api/episodes", {
      anilistId,
      source,
    }),
  );
}

export interface ServerList {
  servers: { name: string; sourceId: string; type: StreamType }[];
  source: string;
}

export function getServers(anilistId: number, ep: number, type: StreamType, source?: StreamSource) {
  return cached(`scr:srv:${anilistId}:${ep}:${type}:${source ?? ""}`, 10 * MIN, () =>
    request<ServerList>("/api/servers", { anilistId, ep, type, source }),
  );
}

/** Stream URLs carry expiring tokens, so they are cached only briefly. */
export function getWatch(
  anilistId: number,
  ep: number,
  type: StreamType,
  source?: StreamSource,
  server?: string,
) {
  return cached(
    `scr:watch:${anilistId}:${ep}:${type}:${source ?? ""}:${server ?? ""}`,
    90,
    () => request<WatchData>("/api/watch", { anilistId, ep, type, source, server }, 40000),
    0,
  );
}

export function getHealth() {
  return request<Record<string, unknown>>("/api/health", undefined, 10000);
}

// ── Metadata ─────────────────────────────────────────────

interface CombinedAnime {
  data: {
    malId: number;
    logo?: string | null;
    cover?: string | null;
    poster?: string | null;
  };
}

/** TMDB/Kitsu artwork plus MAL theme songs for the detail page. */
export function getAnimeArt(malId: number): Promise<AnimeArt> {
  return cached(`scr:art:${malId}`, 24 * HOUR, async () => {
    const [anime, themes] = await Promise.allSettled([
      request<CombinedAnime>("/api/anime", { malId }, 30000),
      request<{ opening: Theme[]; ending: Theme[] }>(`/api/mal/anime/${malId}/themes`),
    ]);
    const a = anime.status === "fulfilled" ? anime.value.data : null;
    return {
      malId,
      logo: a?.logo ?? null,
      cover: a?.cover ?? null,
      poster: a?.poster ?? null,
      themes: themes.status === "fulfilled" ? themes.value : null,
    };
  });
}

function getEpisodeMeta(malId: number) {
  return cached(`scr:epmeta:${malId}`, 6 * HOUR, () =>
    request<{ count: number; episodes: EpisodeMeta[] }>("/api/episode", { malId }, 30000),
  );
}

/**
 * Merges streamable episode numbers (from the source) with titles,
 * thumbnails and filler flags (from MAL/TMDB). Either side may fail.
 */
export async function getEpisodeList(
  anilistId: number,
  malId: number | null,
  fallbackCount: number | null,
): Promise<{ episodes: EpisodeItem[]; streamable: boolean }> {
  return cached(`scr:eplist:${anilistId}`, 30 * MIN, async () => {
    const [src, meta] = await Promise.allSettled([
      getSourceEpisodes(anilistId),
      malId ? getEpisodeMeta(malId) : Promise.reject(new Error("no mal id")),
    ]);
    const metaByNum = new Map<number, EpisodeMeta>();
    if (meta.status === "fulfilled") for (const m of meta.value.episodes) metaByNum.set(m.episode, m);

    let numbers: number[];
    let streamable = false;
    if (src.status === "fulfilled" && src.value.episodes.length) {
      numbers = src.value.episodes.map((e) => e.num);
      streamable = true;
    } else if (metaByNum.size) {
      numbers = [...metaByNum.keys()];
    } else {
      numbers = Array.from({ length: fallbackCount ?? 0 }, (_, i) => i + 1);
    }

    const srcTitles = new Map<number, string | null>();
    if (src.status === "fulfilled") for (const e of src.value.episodes) srcTitles.set(e.num, e.title);

    const episodes = numbers
      .sort((a, b) => a - b)
      .map((n) => {
        const m = metaByNum.get(n);
        const srcTitle = srcTitles.get(n);
        return {
          number: n,
          title: m?.title || (srcTitle && !/^Episode \d+$/i.test(srcTitle) ? srcTitle : null),
          thumbnail: m?.thumbnail ?? null,
          aired: m?.aired ?? null,
          filler: Boolean(m?.filler),
          recap: Boolean(m?.recap),
        };
      });
    return { episodes, streamable };
  });
}
