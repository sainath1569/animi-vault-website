"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, Loader2, MonitorPlay, ListVideo } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player, type PlayerSource } from "./player";
import { EpisodeList } from "../anime/episode-list";
import { ReportButton } from "../anime/report-button";
import { useAuth, useTrackCtx } from "../providers";
import { useAnimeProgress, useSaveSettings, useSettings } from "@/lib/hooks";
import { addHistory, autoStatus, saveProgress, saveProgressOnUnload } from "@/lib/tracking";
import type { AnimeCard, EpisodeItem, StreamSource, StreamType, WatchData } from "@/lib/types";
import { cn } from "@/lib/utils";

const SOURCES: { id: StreamSource; label: string; note?: string }[] = [
  { id: "anikoto", label: "Anikoto" },
  { id: "animeheaven", label: "AnimeHeaven", note: "MP4, sub only" },
  { id: "desidub", label: "DesiDub", note: "Hindi" },
];
/** Sources tried automatically when the chosen one fails. DesiDub is opt-in only. */
const AUTO_ORDER: StreamSource[] = ["anikoto", "animeheaven"];

interface Props {
  anime: AnimeCard;
  episode: number;
}

type Resolved = { mode: "player"; source: PlayerSource } | { mode: "iframe"; url: string } | { mode: "none" };

function resolve(d: WatchData): Resolved {
  const embedOk = d.embedUrl && isRealEmbed(d.embedUrl);
  if (d.iframeOnly && embedOk) return { mode: "iframe", url: d.embedUrl! };
  if (d.streamUrl && (d.playbackMode === "mp4" || !d.hlsProxyUrl)) return { mode: "player", source: { kind: "mp4", url: d.streamUrl } };
  if (d.hlsProxyUrl) return { mode: "player", source: { kind: "hls", url: d.hlsProxyUrl } };
  if (d.m3u8 && !d.note) return { mode: "player", source: { kind: "hls", url: d.m3u8 } };
  if (embedOk) return { mode: "iframe", url: d.embedUrl! };
  return { mode: "none" };
}

function isRealEmbed(url: string) {
  try {
    const u = new URL(url);
    return /embed/i.test(u.pathname) || u.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

async function fetchWatch(id: number, ep: number, type: StreamType, source: StreamSource, server?: string) {
  const qs = new URLSearchParams({ id: String(id), ep: String(ep), type, source });
  if (server) qs.set("server", server);
  const res = await fetch(`/api/watch?${qs}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Stream unavailable");
  return body as WatchData;
}

export function WatchClient({ anime, episode }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const ctx = useTrackCtx();
  const { session } = useAuth();
  const { settings, loaded: settingsLoaded } = useSettings();
  const saveSettings = useSaveSettings();
  const { data: progressRows, isFetched: progressLoaded } = useAnimeProgress(anime.id);

  const [type, setType] = useState<StreamType>("sub");
  const [source, setSource] = useState<StreamSource>("anikoto");
  const [server, setServer] = useState<string | undefined>(undefined);
  const [manual, setManual] = useState(false);
  const [failNote, setFailNote] = useState<string | null>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);
  /** Every automatic source failed to return this episode. */
  const [exhausted, setExhausted] = useState(false);
  const tried = useRef(new Set<string>());
  const [initialized, setInitialized] = useState(false);
  const [lastEpisode, setLastEpisode] = useState(episode);

  // Apply the user's defaults once settings arrive (adjusted during render).
  if (settingsLoaded && !initialized) {
    setInitialized(true);
    setType(settings.default_type);
    setSource(settings.default_source);
    if (settings.default_server) setServer(settings.default_server);
  }

  // New episode: reset fallbacks but keep the chosen type/source.
  if (episode !== lastEpisode) {
    setLastEpisode(episode);
    setFailNote(null);
    setExhausted(false);
  }
  useEffect(() => {
    tried.current.clear();
  }, [episode]);

  const { data: epData } = useQuery({
    queryKey: ["episodes", anime.id],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (anime.idMal) qs.set("malId", String(anime.idMal));
      const count = anime.nextAiring ? anime.nextAiring.episode - 1 : anime.episodes;
      if (count) qs.set("count", String(count));
      const res = await fetch(`/api/episodes/${anime.id}?${qs}`);
      return (await res.json()) as { episodes: EpisodeItem[]; streamable: boolean };
    },
    staleTime: 10 * 60_000,
  });
  const episodes = useMemo(() => epData?.episodes ?? [], [epData]);
  const epIndex = episodes.findIndex((e) => e.number === episode);
  const epMeta = epIndex >= 0 ? episodes[epIndex] : null;
  const maxKnown = anime.nextAiring ? anime.nextAiring.episode - 1 : anime.episodes;
  const prevEp = epIndex > 0 ? episodes[epIndex - 1].number : episode > 1 ? episode - 1 : null;
  const nextEp =
    epIndex >= 0 ? (episodes[epIndex + 1]?.number ?? null) : maxKnown && episode < maxKnown ? episode + 1 : null;

  const watch = useQuery({
    queryKey: ["watch", anime.id, episode, type, source, server ?? ""],
    queryFn: () => fetchWatch(anime.id, episode, type, source, server),
    enabled: initialized,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    retry: 1,
  });

  // Request failed for this source: move to the next automatic source.
  useEffect(() => {
    if (!watch.isError) return;
    tried.current.add(`${source}:*`);
    if (manual) return;
    const next = AUTO_ORDER.find((s) => !tried.current.has(`${s}:*`) && !(type === "dub" && s === "animeheaven"));
    if (next) {
      setFailNote(`${labelOf(source)} didn't have this episode, switched to ${labelOf(next)}.`);
      setServer(undefined);
      setSource(next);
    } else {
      setExhausted(true);
    }
  }, [watch.isError, source, manual, type]);

  const resolved = watch.data ? resolve(watch.data) : null;

  // The stream itself failed in the player: try the next server, then the next source.
  const onFatalError = useCallback(() => {
    const d = watch.data;
    if (!d) return;
    tried.current.add(`${source}:${d.server}`);
    const nextServer = d.availableServers.find((s) => !tried.current.has(`${source}:${s}`));
    if (nextServer) {
      setFailNote(`${d.server} failed, switched to ${nextServer}.`);
      setServer(nextServer);
      return;
    }
    tried.current.add(`${source}:*`);
    const nextSource = AUTO_ORDER.find((s) => !tried.current.has(`${s}:*`) && !(type === "dub" && s === "animeheaven"));
    if (nextSource) {
      setFailNote(`No working server on ${labelOf(source)}, switched to ${labelOf(nextSource)}.`);
      setServer(undefined);
      setSource(nextSource);
      return;
    }
    setFailNote("Every server failed for this episode. Try again later or report it.");
  }, [watch.data, source, type]);

  // ── Tracking ───────────────────────────────────────────
  const resumeAt = useMemo(() => {
    const row = progressRows?.find((p) => p.episode === episode);
    if (!row || row.completed) return 0;
    return row.position_sec;
  }, [progressRows, episode]);

  const progressBase = useMemo(
    () => ({
      anilist_id: anime.id,
      episode,
      type,
      source,
      server: watch.data?.server ?? null,
      title: anime.title,
      poster: anime.banner ?? anime.cover,
      episodes_total: anime.episodes,
    }),
    [anime, episode, type, source, watch.data?.server],
  );
  const lastPos = useRef<{ pos: number; dur: number } | null>(null);
  const markedComplete = useRef(false);

  useEffect(() => {
    markedComplete.current = false;
    lastPos.current = null;
  }, [episode]);

  const entryBase = useMemo(
    () => ({
      anilist_id: anime.id,
      mal_id: anime.idMal,
      title: anime.title,
      poster: anime.cover,
      format: anime.format,
      episodes_total: anime.episodes,
      genres: anime.genres,
    }),
    [anime],
  );

  const persist = useCallback(
    (pos: number, dur: number) => {
      if (!dur || !Number.isFinite(dur)) return;
      lastPos.current = { pos, dur };
      const completed = pos / dur >= 0.9;
      void saveProgress(ctx, {
        ...progressBase,
        position_sec: Math.floor(pos),
        duration_sec: Math.floor(dur),
        completed,
      })
        .then(() => qc.invalidateQueries({ queryKey: ["continue"] }))
        .catch(() => {});
      if (completed && !markedComplete.current) {
        markedComplete.current = true;
        void qc.invalidateQueries({ queryKey: ["progress", anime.id] });
        if (settings.auto_status) {
          void autoStatus(ctx, { ...entryBase, episode, finished: true })
            .then(() => qc.invalidateQueries({ queryKey: ["entry", anime.id] }))
            .catch(() => {});
        }
      }
    },
    [ctx, progressBase, qc, anime.id, settings.auto_status, entryBase, episode],
  );

  // Flush the last position when the tab is hidden or closed.
  useEffect(() => {
    const flush = () => {
      const p = lastPos.current;
      if (!p) return;
      saveProgressOnUnload(
        ctx,
        { ...progressBase, position_sec: Math.floor(p.pos), duration_sec: Math.floor(p.dur), completed: p.pos / p.dur >= 0.9 },
        session?.access_token ?? null,
      );
    };
    const onVis = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", flush);
    };
  }, [ctx, progressBase, session?.access_token]);

  const onFirstPlay = useCallback(() => {
    void addHistory(ctx, { anilist_id: anime.id, episode, title: anime.title, poster: anime.banner ?? anime.cover }).catch(() => {});
    if (settings.auto_status) {
      void autoStatus(ctx, { ...entryBase, episode, finished: false })
        .then(() => qc.invalidateQueries({ queryKey: ["entry", anime.id] }))
        .catch(() => {});
    }
  }, [ctx, anime, episode, settings.auto_status, entryBase, qc]);

  const onNearEnd = useCallback(() => {
    if (!nextEp) return;
    void qc.prefetchQuery({
      queryKey: ["watch", anime.id, nextEp, type, source, server ?? ""],
      queryFn: () => fetchWatch(anime.id, nextEp, type, source, server),
      staleTime: 60_000,
    });
  }, [qc, anime.id, nextEp, type, source, server]);

  const goTo = useCallback((ep: number | null) => ep && router.push(`/watch/${anime.id}/${ep}`), [router, anime.id]);

  // ── UI helpers ─────────────────────────────────────────
  function pickType(t: StreamType) {
    if (t === type) return;
    tried.current.clear();
    setFailNote(null);
    setExhausted(false);
    setServer(undefined);
    if (t === "dub" && source === "animeheaven") setSource("anikoto");
    setType(t);
  }
  function pickSource(s: StreamSource) {
    tried.current.clear();
    setFailNote(null);
    setExhausted(false);
    setManual(true);
    setServer(undefined);
    setSource(s);
  }
  function pickServer(s: string) {
    tried.current.clear();
    setFailNote(null);
    setServer(s);
  }

  const epTitle = epMeta?.title ? `EP ${episode} · ${epMeta.title}` : `Episode ${episode}`;
  const ready = settingsLoaded && progressLoaded;

  return (
    <div className="mx-auto max-w-[1800px] px-0 pt-0 sm:px-4 sm:pt-4 md:px-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          {/* Player area */}
          <div className="relative">
            {!ready || watch.isPending ? (
              <PlayerShell>
                <Loader2 className="size-10 animate-spin text-white/80" />
              </PlayerShell>
            ) : watch.isError && (manual || exhausted) ? (
              <PlayerShell>
                <AlertTriangle className="size-10 text-warn" />
                <p className="mt-3 max-w-sm px-6 text-center font-semibold">{(watch.error as Error).message}</p>
                <p className="mt-1 px-6 text-center text-sm text-muted">
                  {type === "dub" ? "A dub may not exist for this episode. Try Sub, or another source." : "Try another source below."}
                </p>
                {type === "dub" && (
                  <button type="button" onClick={() => pickType("sub")} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold">
                    Switch to Sub
                  </button>
                )}
              </PlayerShell>
            ) : watch.isError ? (
              <PlayerShell>
                <Loader2 className="size-10 animate-spin text-white/80" />
                <p className="mt-3 text-sm text-muted">Finding another source…</p>
              </PlayerShell>
            ) : resolved?.mode === "player" ? (
              <Player
                key={`${resolved.source.url}`}
                source={resolved.source}
                subtitles={watch.data!.subtitles ?? []}
                intro={watch.data!.intro}
                outro={watch.data!.outro}
                startAt={resumeAt}
                title={anime.title}
                subtitle={epTitle}
                poster={epMeta?.thumbnail ?? anime.banner}
                subPrefs={settings.subtitle_prefs}
                autoSkipIntro={settings.skip_intro}
                autoplayNext={settings.autoplay_next}
                hasNext={Boolean(nextEp)}
                hasPrev={Boolean(prevEp)}
                onNext={() => goTo(nextEp)}
                onPrev={() => goTo(prevEp)}
                onProgress={persist}
                onPause={persist}
                onEnded={() => {}}
                onFirstPlay={onFirstPlay}
                onNearEnd={onNearEnd}
                onFatalError={onFatalError}
                onSubPrefsChange={(subtitle_prefs) => saveSettings.mutate({ subtitle_prefs })}
              />
            ) : resolved?.mode === "iframe" ? (
              <div className="relative aspect-video w-full overflow-hidden bg-black sm:rounded-xl">
                <iframe
                  src={resolved.url}
                  title={`${anime.title} episode ${episode}`}
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  referrerPolicy="origin"
                  className="size-full"
                />
                <span className="pointer-events-none absolute left-3 top-3 rounded bg-black/70 px-2 py-1 text-[11px] text-muted">
                  Alternate player
                </span>
              </div>
            ) : (
              <PlayerShell>
                <AlertTriangle className="size-10 text-warn" />
                <p className="mt-3 font-semibold">No playable stream on this server.</p>
              </PlayerShell>
            )}
          </div>

          {failNote && (
            <p className="mx-4 mt-3 rounded-lg bg-warn/10 px-3 py-2 text-sm text-warn ring-1 ring-warn/30 sm:mx-0">{failNote}</p>
          )}

          {/* Title + episode nav */}
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3 px-4 sm:px-0">
            <div className="min-w-0">
              <Link href={`/anime/${anime.id}`} className="text-sm font-semibold text-accent hover:underline">
                {anime.title}
              </Link>
              <h1 className="mt-0.5 text-lg font-bold leading-snug md:text-xl">{epTitle}</h1>
              {(epMeta?.filler || epMeta?.recap) && (
                <p className="mt-1 text-xs font-semibold uppercase text-warn">{epMeta.filler ? "Filler episode" : "Recap episode"}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <NavButton disabled={!prevEp} onClick={() => goTo(prevEp)}>
                <ChevronLeft className="size-4" /> Prev
              </NavButton>
              <NavButton disabled={!nextEp} onClick={() => goTo(nextEp)}>
                Next <ChevronRight className="size-4" />
              </NavButton>
            </div>
          </div>

          {/* Stream controls */}
          <div className="mx-4 mt-4 space-y-3 rounded-xl bg-elev p-4 ring-1 ring-white/5 sm:mx-0">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <ControlGroup label="Audio">
                {(["sub", "dub"] as const).map((t) => (
                  <Chip key={t} active={type === t} onClick={() => pickType(t)}>
                    {t.toUpperCase()}
                  </Chip>
                ))}
              </ControlGroup>
              <ControlGroup label="Source">
                {SOURCES.map((s) => (
                  <Chip
                    key={s.id}
                    active={source === s.id}
                    onClick={() => pickSource(s.id)}
                    disabled={type === "dub" && s.id === "animeheaven"}
                    title={s.note}
                  >
                    {s.label}
                  </Chip>
                ))}
              </ControlGroup>
            </div>
            {watch.data && watch.data.availableServers.length > 0 && (
              <ControlGroup label="Server">
                {watch.data.availableServers.map((s) => (
                  <Chip key={s} active={watch.data!.server === s} onClick={() => pickServer(s)}>
                    {s}
                  </Chip>
                ))}
              </ControlGroup>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <ToggleChip
                on={settings.autoplay_next}
                onClick={() => saveSettings.mutate({ autoplay_next: !settings.autoplay_next })}
              >
                Auto-next
              </ToggleChip>
              <ToggleChip on={settings.skip_intro} onClick={() => saveSettings.mutate({ skip_intro: !settings.skip_intro })}>
                Auto-skip intro
              </ToggleChip>
              {resolved?.mode === "player" && resolved.source.kind === "mp4" ? (
                <a
                  href={resolved.source.url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-white/10 hover:text-fg"
                >
                  <Download className="size-3.5" /> Download
                </a>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-dim" title="Switch to AnimeHeaven for downloadable MP4">
                  <Download className="size-3.5" /> Download not available for this server
                </span>
              )}
              {resolved?.mode === "iframe" && (
                <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-dim">
                  <MonitorPlay className="size-3.5" /> Alternate player
                </span>
              )}
              <div className="ml-auto">
                <ReportButton anilistId={anime.id} episode={episode} compact />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowEpisodes((s) => !s)}
            className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-xl bg-elev py-3 text-sm font-semibold ring-1 ring-white/5 sm:mx-0 sm:w-full xl:hidden"
          >
            <ListVideo className="size-4" /> {showEpisodes ? "Hide episodes" : `Episodes (${episodes.length || "…"})`}
          </button>
        </div>

        {/* Episode drawer */}
        <aside className={cn("min-w-0 px-4 sm:px-0", !showEpisodes && "hidden xl:block")}>
          <div className="rounded-xl bg-elev/60 p-3 ring-1 ring-white/5 xl:sticky xl:top-[calc(var(--nav-h)+1rem)]">
            <h2 className="mb-3 px-1 font-semibold">Episodes</h2>
            <div className="thin-scrollbar max-h-[70vh] overflow-y-auto pr-1">
              {epData ? (
                <EpisodeList animeId={anime.id} episodes={episodes} current={episode} variant="drawer" />
              ) : (
                <div className="space-y-1.5">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div key={i} className="skeleton h-10 rounded-lg" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function labelOf(s: StreamSource) {
  return SOURCES.find((x) => x.id === s)?.label ?? s;
}

function PlayerShell({ children }: { children: React.ReactNode }) {
  return <div className="flex aspect-video w-full flex-col items-center justify-center bg-black sm:rounded-xl">{children}</div>;
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-14 text-xs font-semibold uppercase tracking-wider text-dim">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  children,
  active,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        active ? "bg-accent text-white" : "bg-elev-2 text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function ToggleChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-white/10 hover:text-fg"
    >
      <span className={cn("relative h-4 w-7 rounded-full transition-colors", on ? "bg-accent" : "bg-white/20")}>
        <span className={cn("absolute top-0.5 size-3 rounded-full bg-white transition-all", on ? "left-3.5" : "left-0.5")} />
      </span>
      {children}
    </button>
  );
}

function NavButton({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 rounded-full bg-elev-2 px-4 py-2 text-sm font-semibold transition-colors hover:bg-white/15 disabled:opacity-35"
    >
      {children}
    </button>
  );
}
