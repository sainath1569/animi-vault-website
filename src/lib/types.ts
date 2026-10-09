// ── AniList ──────────────────────────────────────────────

export type MediaFormat = "TV" | "TV_SHORT" | "MOVIE" | "SPECIAL" | "OVA" | "ONA" | "MUSIC";
export type MediaStatus = "FINISHED" | "RELEASING" | "NOT_YET_RELEASED" | "CANCELLED" | "HIATUS";
export type MediaSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export interface AiringEpisode {
  episode: number;
  airingAt: number;
  timeUntilAiring: number;
}

/** Card-sized anime record used by every row, grid and list. */
export interface AnimeCard {
  id: number;
  idMal: number | null;
  title: string;
  titleRomaji: string;
  cover: string;
  coverColor: string | null;
  banner: string | null;
  format: MediaFormat | null;
  status: MediaStatus | null;
  episodes: number | null;
  score: number | null;
  year: number | null;
  season: MediaSeason | null;
  genres: string[];
  description: string | null;
  nextAiring: AiringEpisode | null;
  duration: number | null;
}

export interface CharacterEdge {
  id: number;
  name: string;
  image: string | null;
  role: "MAIN" | "SUPPORTING" | "BACKGROUND";
  voiceActor: { id: number; name: string; image: string | null; language: string } | null;
}

export interface RelationEdge {
  relationType: string;
  anime: AnimeCard;
}

export interface AnimeDetail extends AnimeCard {
  titleEnglish: string | null;
  titleNative: string | null;
  synonyms: string[];
  studios: string[];
  source: string | null;
  popularity: number | null;
  favourites: number | null;
  startDate: string | null;
  endDate: string | null;
  trailer: { id: string; site: string } | null;
  characters: CharacterEdge[];
  relations: RelationEdge[];
  recommendations: AnimeCard[];
  externalLinks: { site: string; url: string; type: string | null; icon: string | null; color: string | null }[];
  tags: string[];
  rankings: { rank: number; type: string; allTime: boolean; context: string; year: number | null }[];
}

export interface ScheduleItem {
  id: number;
  episode: number;
  airingAt: number;
  anime: AnimeCard;
}

export interface PageInfo {
  currentPage: number;
  hasNextPage: boolean;
  total?: number;
}

// ── Scraper ──────────────────────────────────────────────

export type StreamType = "sub" | "dub";
export type StreamSource = "anikoto" | "animeheaven" | "desidub";

export interface ScraperEpisode {
  num: number;
  id: string;
  title: string | null;
}

export interface EpisodeMeta {
  episode: number;
  title: string | null;
  titleJapanese?: string | null;
  aired?: string | null;
  filler?: boolean;
  recap?: boolean;
  thumbnail?: string | null;
}

/** One entry in the merged episode list shown on detail and watch pages. */
export interface EpisodeItem {
  number: number;
  title: string | null;
  thumbnail: string | null;
  aired: string | null;
  filler: boolean;
  recap: boolean;
}

export interface SubtitleTrack {
  url: string;
  lang: string;
  default?: boolean;
}

export interface WatchData {
  anilistId: number;
  malId: number | null;
  title: string;
  episode: number;
  type: StreamType;
  source: StreamSource;
  server: string;
  availableServers: string[];
  embedUrl: string | null;
  m3u8?: string | null;
  hlsProxyUrl?: string | null;
  streamUrl?: string | null;
  playbackMode?: "hls" | "mp4" | "iframe" | string;
  iframeOnly?: boolean;
  subtitles: SubtitleTrack[];
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
  note: string | null;
}

export interface AnimeArt {
  malId: number;
  logo: string | null;
  cover: string | null;
  poster: string | null;
  themes: { opening: Theme[]; ending: Theme[] } | null;
}

export interface Theme {
  number: number;
  title: string;
  artist: string | null;
  episodes: string | null;
  spotifyUrl: string | null;
}

// ── Database rows ────────────────────────────────────────

export type ListStatus = "watching" | "completed" | "plan" | "dropped";

export interface ListEntry {
  anilist_id: number;
  mal_id: number | null;
  title: string;
  poster: string | null;
  format: string | null;
  episodes_total: number | null;
  genres: string[];
  status: ListStatus;
  progress: number;
  score: number | null;
  notes: string | null;
  updated_at: string;
}

export interface WatchProgress {
  anilist_id: number;
  episode: number;
  position_sec: number;
  duration_sec: number;
  type: StreamType;
  source: string | null;
  server: string | null;
  completed: boolean;
  title: string | null;
  poster: string | null;
  episodes_total: number | null;
  updated_at: string;
}

export interface UserSettings {
  default_type: StreamType;
  default_source: StreamSource;
  default_server: string | null;
  autoplay_next: boolean;
  skip_intro: boolean;
  auto_status: boolean;
  subtitle_prefs: { size: "sm" | "md" | "lg" | "xl"; background: "none" | "dim" | "solid"; enabled: boolean };
}

export const DEFAULT_SETTINGS: UserSettings = {
  default_type: "sub",
  default_source: "anikoto",
  default_server: null,
  autoplay_next: true,
  skip_intro: false,
  auto_status: true,
  subtitle_prefs: { size: "md", background: "dim", enabled: true },
};
