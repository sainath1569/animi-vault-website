"use client";

import type Hls from "hls.js";
import type { Level } from "hls.js";
import {
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { SubtitleTrack, UserSettings } from "@/lib/types";
import { cn, formatTime } from "@/lib/utils";

export interface PlayerSource {
  kind: "hls" | "mp4";
  url: string;
}

export interface PlayerProps {
  source: PlayerSource;
  subtitles: SubtitleTrack[];
  intro: { start: number; end: number } | null;
  outro: { start: number; end: number } | null;
  startAt?: number;
  title: string;
  subtitle?: string;
  poster?: string | null;
  subPrefs: UserSettings["subtitle_prefs"];
  autoSkipIntro: boolean;
  autoplayNext: boolean;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  onProgress: (position: number, duration: number) => void;
  onPause: (position: number, duration: number) => void;
  onEnded: () => void;
  onFirstPlay: () => void;
  onNearEnd: () => void;
  /** The stream can't be played at all; the parent should try another server. */
  onFatalError: (message: string) => void;
  onSubPrefsChange: (prefs: UserSettings["subtitle_prefs"]) => void;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const HIDE_AFTER = 3000;
const AUTONEXT_SECONDS = 8;

type Menu = null | "main" | "quality" | "speed" | "subs" | "subStyle";

export function Player(props: PlayerProps) {
  const {
    source,
    subtitles,
    intro,
    outro,
    startAt = 0,
    subPrefs,
    autoSkipIntro,
    autoplayNext,
    hasNext,
    hasPrev,
  } = props;

  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{ t: number; x: number } | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstPlayFired = useRef(false);
  const nearEndFired = useRef(false);
  const lastProgress = useRef(0);
  const skippedIntro = useRef(false);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [controls, setControls] = useState(true);
  const [menu, setMenu] = useState<Menu>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [level, setLevel] = useState(-1);
  const [activeLevel, setActiveLevel] = useState(-1);
  const [subIndex, setSubIndex] = useState(() => (subPrefs.enabled ? defaultSubIndex(subtitles) : -1));
  const [hover, setHover] = useState<{ x: number; t: number } | null>(null);
  const [seekFlash, setSeekFlash] = useState<null | { dir: -1 | 1; key: number }>(null);
  const [autoNext, setAutoNext] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resumedFrom, setResumedFrom] = useState<number | null>(null);
  /** False until the first frame plays; the poster image covers the video until then. */
  const [started, setStarted] = useState(false);

  // ── Source setup ───────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    setErrorMsg(null);
    setWaiting(true);
    setLevels([]);
    setLevel(-1);
    firstPlayFired.current = false;
    nearEndFired.current = false;
    skippedIntro.current = false;
    setAutoNext(null);

    const seekToStart = () => {
      if (startAt > 5 && video.duration && startAt < video.duration - 10) {
        video.currentTime = startAt;
        setResumedFrom(startAt);
        setTimeout(() => setResumedFrom(null), 4000);
      }
    };
    const tryPlay = () => {
      video.play().catch(() => {
        // Autoplay with sound blocked: start muted rather than not at all.
        video.muted = true;
        setMuted(true);
        video.play().catch(() => setWaiting(false));
      });
    };

    if (source.kind === "mp4") {
      video.src = source.url;
      video.addEventListener("loadedmetadata", seekToStart, { once: true });
      tryPlay();
      return () => {
        video.removeAttribute("src");
        video.load();
      };
    }

    const native = video.canPlayType("application/vnd.apple.mpegurl");
    import("hls.js").then(({ default: HlsCtor }) => {
      if (destroyed) return;
      if (!HlsCtor.isSupported()) {
        if (native) {
          video.src = source.url;
          video.addEventListener("loadedmetadata", seekToStart, { once: true });
          tryPlay();
        } else {
          setErrorMsg("Your browser can't play this stream.");
        }
        return;
      }
      const hls = new HlsCtor({
        maxBufferLength: 30,
        maxMaxBufferLength: 90,
        backBufferLength: 30,
        lowLatencyMode: false,
        enableWorker: true,
        startLevel: -1,
        fragLoadingMaxRetry: 4,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 3,
      });
      hlsRef.current = hls;
      let mediaRecoveries = 0;
      hls.on(HlsCtor.Events.MANIFEST_PARSED, (_e, data) => {
        setLevels(data.levels);
        seekToStart();
        tryPlay();
      });
      hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_e, data) => setActiveLevel(data.level));
      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries++;
          hls.recoverMediaError();
          return;
        }
        const msg =
          data.type === HlsCtor.ErrorTypes.NETWORK_ERROR
            ? "The stream stopped responding."
            : "This stream couldn't be decoded.";
        setErrorMsg(msg);
        propsRef.current.onFatalError(msg);
      });
      hls.loadSource(source.url);
      hls.attachMedia(video);
    });

    return () => {
      destroyed = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // startAt is read once per source on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.kind, source.url]);

  // ── Subtitle track selection ───────────────────────────
  useEffect(() => {
    setSubIndex(propsRef.current.subPrefs.enabled ? defaultSubIndex(subtitles) : -1);
  }, [subtitles]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].mode = i === subIndex ? "showing" : "disabled";
      }
    };
    apply();
    video.textTracks.addEventListener?.("addtrack", apply);
    return () => video.textTracks.removeEventListener?.("addtrack", apply);
  }, [subIndex, subtitles]);

  // Lift subtitles above the control bar while it's visible.
  const showControls = controls || !playing || menu != null;
  useEffect(() => {
    const video = videoRef.current;
    if (!video || subIndex < 0) return;
    const track = video.textTracks[subIndex];
    if (!track) return;
    const place = () => {
      for (const cue of Array.from(track.cues ?? [])) {
        (cue as VTTCue).line = showControls ? -4 : "auto";
      }
    };
    place();
    track.addEventListener("cuechange", place);
    return () => track.removeEventListener("cuechange", place);
  }, [showControls, subIndex, subtitles]);

  // ── Controls auto-hide ─────────────────────────────────
  const poke = useCallback(() => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setControls(false);
        setMenu(null);
      }
    }, HIDE_AFTER);
  }, []);


  // ── Actions ────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration - 0.5, v.currentTime + delta));
    setSeekFlash({ dir: delta < 0 ? -1 : 1, key: Date.now() });
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const root = rootRef.current;
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!root) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        screen.orientation?.unlock?.();
      } else if (root.requestFullscreen) {
        await root.requestFullscreen();
        // Landscape on phones; ignored where unsupported.
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
          ?.lock?.("landscape")
          .catch(() => {});
      } else if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch {
      // Fullscreen denied.
    }
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      // PiP unsupported.
    }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) v.volume = 0.5;
  }, []);

  const toggleSubs = useCallback(() => {
    setSubIndex((i) => {
      const next = i >= 0 ? -1 : Math.max(0, defaultSubIndex(propsRef.current.subtitles));
      propsRef.current.onSubPrefsChange({ ...propsRef.current.subPrefs, enabled: next >= 0 });
      return next;
    });
  }, []);

  const setQuality = (idx: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.currentLevel = idx;
      setLevel(idx);
    }
    setMenu(null);
  };

  const setSpeed = (r: number) => {
    if (videoRef.current) videoRef.current.playbackRate = r;
    setRate(r);
    setMenu(null);
  };

  // ── Keyboard shortcuts ─────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const v = videoRef.current;
      if (!v) return;
      let handled = true;
      switch (e.key) {
        case " ":
        case "k":
        case "K":
          togglePlay();
          break;
        case "ArrowLeft":
        case "j":
        case "J":
          seekBy(e.key === "ArrowLeft" ? -5 : -10);
          break;
        case "ArrowRight":
        case "l":
        case "L":
          seekBy(e.key === "ArrowRight" ? 5 : 10);
          break;
        case "ArrowUp":
          v.volume = Math.min(1, v.volume + 0.1);
          v.muted = false;
          break;
        case "ArrowDown":
          v.volume = Math.max(0, v.volume - 0.1);
          break;
        case "f":
        case "F":
          void toggleFullscreen();
          break;
        case "m":
        case "M":
          toggleMute();
          break;
        case "c":
        case "C":
          toggleSubs();
          break;
        case "N":
          if (e.shiftKey && propsRef.current.hasNext) propsRef.current.onNext();
          else handled = false;
          break;
        case "P":
          if (e.shiftKey && propsRef.current.hasPrev) propsRef.current.onPrev();
          else handled = false;
          break;
        default:
          if (/^[0-9]$/.test(e.key) && Number.isFinite(v.duration)) {
            v.currentTime = (v.duration * Number(e.key)) / 10;
          } else handled = false;
      }
      if (handled) {
        e.preventDefault();
        poke();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, seekBy, toggleFullscreen, toggleMute, toggleSubs, poke]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── Auto-next countdown ────────────────────────────────
  useEffect(() => {
    if (autoNext == null) return;
    const t = setTimeout(() => {
      if (autoNext <= 1) {
        setAutoNext(null);
        propsRef.current.onNext();
      } else {
        setAutoNext(autoNext - 1);
      }
    }, 1000);
    return () => clearTimeout(t);
  }, [autoNext]);

  // ── Video events ───────────────────────────────────────
  function onTimeUpdate() {
    const v = videoRef.current!;
    const t = v.currentTime;
    setTime(t);
    if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    const d = v.duration;
    if (!Number.isFinite(d) || d <= 0) return;

    if (autoSkipIntro && intro && !skippedIntro.current && t >= intro.start && t < intro.end - 1) {
      skippedIntro.current = true;
      v.currentTime = intro.end;
    }
    if (!nearEndFired.current && t / d >= 0.8) {
      nearEndFired.current = true;
      propsRef.current.onNearEnd();
    }
    if (Math.abs(t - lastProgress.current) >= 15) {
      lastProgress.current = t;
      propsRef.current.onProgress(t, d);
    }
  }

  function onEnded() {
    const v = videoRef.current!;
    propsRef.current.onEnded();
    propsRef.current.onProgress(v.duration, v.duration);
    if (autoplayNext && hasNext) setAutoNext(AUTONEXT_SECONDS);
  }

  // ── Touch: single tap toggles controls, double tap seeks ──
  function onSurfacePointer(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse") {
      if (menu) setMenu(null);
      else togglePlay();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 300) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = null;
      if (x < rect.width * 0.4) seekBy(-10);
      else if (x > rect.width * 0.6) seekBy(10);
      else void toggleFullscreen();
      poke();
      return;
    }
    lastTap.current = { t: now, x };
    tapTimer.current = setTimeout(() => {
      lastTap.current = null;
      if (menu) setMenu(null);
      else if (controls && playing) setControls(false);
      else poke();
    }, 280);
  }

  const inIntro = intro && time >= intro.start && time < intro.end - 1;
  const inOutro = outro && time >= outro.start && time < outro.end - 1 && hasNext;
  const pct = duration ? (time / duration) * 100 : 0;
  const bufPct = duration ? (buffered / duration) * 100 : 0;
  const VolIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const show = showControls;

  return (
    <div
      ref={rootRef}
      className={cn(
        "player group/player relative aspect-video w-full select-none overflow-hidden bg-black",
        fullscreen ? "h-full" : "rounded-none sm:rounded-xl",
        !show && "cursor-none",
      )}
      data-sub-size={subPrefs.size}
      data-sub-bg={subPrefs.background}
      onPointerMove={(e) => e.pointerType === "mouse" && poke()}
      onMouseLeave={() => playing && setControls(false)}
    >
      <video
        ref={videoRef}
        className="size-full"
        crossOrigin="anonymous"
        playsInline
        preload="auto"
        onPlay={() => {
          setPlaying(true);
          poke();
          if (!firstPlayFired.current) {
            firstPlayFired.current = true;
            propsRef.current.onFirstPlay();
          }
        }}
        onPause={() => {
          setPlaying(false);
          setControls(true);
          const v = videoRef.current!;
          if (Number.isFinite(v.duration)) propsRef.current.onPause(v.currentTime, v.duration);
        }}
        onWaiting={() => setWaiting(true)}
        onPlaying={() => {
          setWaiting(false);
          setStarted(true);
        }}
        onCanPlay={() => setWaiting(false)}
        onLoadedMetadata={() => setDuration(videoRef.current!.duration)}
        onDurationChange={() => setDuration(videoRef.current!.duration)}
        onTimeUpdate={onTimeUpdate}
        onProgress={() => {
          const v = videoRef.current!;
          if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
        }}
        onVolumeChange={() => {
          const v = videoRef.current!;
          setVolume(v.volume);
          setMuted(v.muted);
        }}
        onRateChange={() => setRate(videoRef.current!.playbackRate)}
        onEnded={onEnded}
        onError={() => {
          if (source.kind !== "mp4") return;
          const msg = "This video file couldn't be loaded.";
          setErrorMsg(msg);
          propsRef.current.onFatalError(msg);
        }}
      >
        {subtitles.map((s, i) => (
          <track key={s.url} kind="subtitles" src={s.url} srcLang={langCode(s.lang)} label={s.lang} default={i === subIndex} />
        ))}
      </video>

      {/* Poster as a plain image: the video's poster attribute would load in CORS mode and get blocked. */}
      {!started && props.poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.poster} alt="" className="pointer-events-none absolute inset-0 size-full object-cover opacity-60" />
      )}

      {/* Tap / click surface */}
      <div className="absolute inset-0" onPointerUp={onSurfacePointer} onDoubleClick={() => void toggleFullscreen()} />

      {/* Seek flash */}
      {seekFlash && (
        <div
          key={seekFlash.key}
          className={cn(
            "pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-black/60 px-4 py-3 text-sm font-semibold animate-[fadeIn_0.2s_ease_both]",
            seekFlash.dir < 0 ? "left-[12%]" : "right-[12%]",
          )}
          onAnimationEnd={() => setTimeout(() => setSeekFlash(null), 400)}
        >
          {seekFlash.dir < 0 ? <RotateCcw className="size-5" /> : <RotateCw className="size-5" />}
          10s
        </div>
      )}

      {/* Buffering */}
      {waiting && !errorMsg && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-12 animate-spin text-white/90" />
        </div>
      )}

      {/* Big play button when paused */}
      {!playing && !waiting && !errorMsg && autoNext == null && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent/90 shadow-2xl transition hover:scale-105 md:size-20"
        >
          <Play className="ml-1 size-8 fill-white text-white md:size-9" />
        </button>
      )}

      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center">
          <p className="font-semibold">{errorMsg}</p>
          <p className="text-sm text-muted">Trying another server…</p>
        </div>
      )}

      {resumedFrom != null && (
        <div className="pointer-events-none absolute left-4 top-16 rounded-lg bg-black/75 px-3 py-2 text-sm fade-in">
          Resumed from {formatTime(resumedFrom)}
        </div>
      )}

      {/* Skip intro / outro */}
      {inIntro && !autoSkipIntro && (
        <SkipButton onClick={() => videoRef.current && (videoRef.current.currentTime = intro!.end)}>Skip intro</SkipButton>
      )}
      {inOutro && (
        <SkipButton onClick={props.onNext}>
          Next episode <SkipForward className="size-4" />
        </SkipButton>
      )}

      {/* Auto-next overlay */}
      {autoNext != null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 text-center">
          <p className="text-sm uppercase tracking-widest text-muted">Next episode in</p>
          <p className="font-[family-name:var(--font-display)] text-6xl font-extrabold tabular-nums">{autoNext}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setAutoNext(null)} className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold hover:bg-white/25">
              Cancel
            </button>
            <button type="button" onClick={props.onNext} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold hover:bg-accent-hover">
              <Play className="size-4 fill-white" /> Play now
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 to-transparent px-4 pb-10 pt-3 transition-opacity duration-300 md:px-5",
          show ? "opacity-100" : "opacity-0",
        )}
      >
        <p className="truncate text-sm font-semibold md:text-base">{props.title}</p>
        {props.subtitle && <p className="truncate text-xs text-fg/70">{props.subtitle}</p>}
      </div>

      {/* Bottom controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-3 pb-2 pt-12 transition-opacity duration-300 md:px-5 md:pb-3",
          show ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onPointerMove={poke}
      >
        {/* Seek bar */}
        <div
          className="group/seek relative h-4 cursor-pointer"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            setHover({ x: ratio * r.width, t: ratio * duration });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/20 transition-all group-hover/seek:h-1.5">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/35" style={{ width: `${bufPct}%` }} />
            <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${pct}%` }} />
            {intro && duration > 0 && (
              <div className="absolute inset-y-0 bg-warn/60" style={{ left: `${(intro.start / duration) * 100}%`, width: `${((intro.end - intro.start) / duration) * 100}%` }} />
            )}
          </div>
          <input
            type="range"
            className="seek absolute inset-0 w-full opacity-100"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            aria-label="Seek"
            onChange={(e) => {
              const v = videoRef.current;
              if (v) v.currentTime = Number(e.target.value);
              setTime(Number(e.target.value));
            }}
          />
          {hover && duration > 0 && (
            <span
              className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-black/85 px-2 py-1 text-xs tabular-nums"
              style={{ left: hover.x }}
            >
              {formatTime(hover.t)}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1 md:gap-2">
          <CtrlButton label={playing ? "Pause (k)" : "Play (k)"} onClick={togglePlay}>
            {playing ? <Pause className="size-6 fill-white" /> : <Play className="size-6 fill-white" />}
          </CtrlButton>
          <CtrlButton label="Back 10s (j)" onClick={() => seekBy(-10)} className="hidden sm:flex">
            <RotateCcw className="size-5" />
          </CtrlButton>
          <CtrlButton label="Forward 10s (l)" onClick={() => seekBy(10)} className="hidden sm:flex">
            <RotateCw className="size-5" />
          </CtrlButton>
          {hasPrev && (
            <CtrlButton label="Previous episode (Shift+P)" onClick={props.onPrev} className="hidden md:flex">
              <ChevronLeft className="size-6" />
            </CtrlButton>
          )}
          {hasNext && (
            <CtrlButton label="Next episode (Shift+N)" onClick={props.onNext}>
              <SkipForward className="size-5 fill-white" />
            </CtrlButton>
          )}
          <div className="group/vol flex items-center">
            <CtrlButton label="Mute (m)" onClick={toggleMute}>
              <VolIcon className="size-5" />
            </CtrlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label="Volume"
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                v.volume = Number(e.target.value);
                v.muted = v.volume === 0;
              }}
              className="hidden w-0 accent-white opacity-0 transition-all duration-200 group-hover/vol:w-20 group-hover/vol:opacity-100 md:block"
            />
          </div>
          <span className="ml-1 text-xs tabular-nums text-fg/85 md:text-sm">
            {formatTime(time)} <span className="text-fg/50">/ {formatTime(duration)}</span>
          </span>

          <div className="relative ml-auto flex items-center gap-1 md:gap-2">
            {subtitles.length > 0 && (
              <CtrlButton label="Subtitles (c)" onClick={() => setMenu(menu === "subs" ? null : "subs")} active={subIndex >= 0}>
                <Captions className="size-5" />
              </CtrlButton>
            )}
            <CtrlButton label="Settings" onClick={() => setMenu(menu ? null : "main")}>
              <Settings2 className={cn("size-5 transition-transform", menu && "rotate-45")} />
            </CtrlButton>
            <CtrlButton label="Picture in picture" onClick={togglePip} className="hidden sm:flex">
              <PictureInPicture2 className="size-5" />
            </CtrlButton>
            <CtrlButton label="Fullscreen (f)" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </CtrlButton>

            {menu && (
              <div className="absolute bottom-12 right-0 z-20 max-h-[60vh] w-64 overflow-y-auto rounded-xl border border-white/10 bg-black/90 py-1.5 text-sm shadow-2xl backdrop-blur-xl thin-scrollbar">
                {menu === "main" && (
                  <>
                    {levels.length > 1 && (
                      <MenuRow onClick={() => setMenu("quality")} icon={<Settings2 className="size-4" />} value={qualityLabel(levels, level, activeLevel)}>
                        Quality
                      </MenuRow>
                    )}
                    <MenuRow onClick={() => setMenu("speed")} icon={<Gauge className="size-4" />} value={rate === 1 ? "Normal" : `${rate}x`}>
                      Speed
                    </MenuRow>
                    {subtitles.length > 0 && (
                      <>
                        <MenuRow onClick={() => setMenu("subs")} icon={<Captions className="size-4" />} value={subIndex >= 0 ? subtitles[subIndex]?.lang : "Off"}>
                          Subtitles
                        </MenuRow>
                        <MenuRow onClick={() => setMenu("subStyle")} icon={<Captions className="size-4" />} value={`${subPrefs.size.toUpperCase()} · ${subPrefs.background}`}>
                          Subtitle style
                        </MenuRow>
                      </>
                    )}
                  </>
                )}
                {menu === "quality" && (
                  <>
                    <MenuBack onClick={() => setMenu("main")}>Quality</MenuBack>
                    <MenuOption selected={level === -1} onClick={() => setQuality(-1)}>
                      Auto{level === -1 && activeLevel >= 0 && levels[activeLevel] ? ` (${levels[activeLevel].height}p)` : ""}
                    </MenuOption>
                    {levels
                      .map((l, i) => ({ l, i }))
                      .sort((a, b) => (b.l.height ?? 0) - (a.l.height ?? 0))
                      .map(({ l, i }) => (
                        <MenuOption key={i} selected={level === i} onClick={() => setQuality(i)}>
                          {l.height ? `${l.height}p` : `${Math.round(l.bitrate / 1000)} kbps`}
                        </MenuOption>
                      ))}
                  </>
                )}
                {menu === "speed" && (
                  <>
                    <MenuBack onClick={() => setMenu("main")}>Speed</MenuBack>
                    {SPEEDS.map((s) => (
                      <MenuOption key={s} selected={rate === s} onClick={() => setSpeed(s)}>
                        {s === 1 ? "Normal" : `${s}x`}
                      </MenuOption>
                    ))}
                  </>
                )}
                {menu === "subs" && (
                  <>
                    <MenuBack onClick={() => setMenu("main")}>Subtitles</MenuBack>
                    <MenuOption
                      selected={subIndex === -1}
                      onClick={() => {
                        setSubIndex(-1);
                        props.onSubPrefsChange({ ...subPrefs, enabled: false });
                        setMenu(null);
                      }}
                    >
                      Off
                    </MenuOption>
                    {subtitles.map((s, i) => (
                      <MenuOption
                        key={s.url}
                        selected={subIndex === i}
                        onClick={() => {
                          setSubIndex(i);
                          props.onSubPrefsChange({ ...subPrefs, enabled: true });
                          setMenu(null);
                        }}
                      >
                        {s.lang}
                      </MenuOption>
                    ))}
                  </>
                )}
                {menu === "subStyle" && (
                  <>
                    <MenuBack onClick={() => setMenu("main")}>Subtitle style</MenuBack>
                    <p className="px-4 pb-1 pt-2 text-xs uppercase tracking-wider text-dim">Size</p>
                    <div className="flex gap-1 px-3 pb-2">
                      {(["sm", "md", "lg", "xl"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => props.onSubPrefsChange({ ...subPrefs, size: s })}
                          className={cn("flex-1 rounded-md py-1.5 text-xs font-semibold", subPrefs.size === s ? "bg-accent" : "bg-white/10 hover:bg-white/20")}
                        >
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    <p className="px-4 pb-1 pt-1 text-xs uppercase tracking-wider text-dim">Background</p>
                    <div className="flex gap-1 px-3 pb-2">
                      {(["none", "dim", "solid"] as const).map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => props.onSubPrefsChange({ ...subPrefs, background: b })}
                          className={cn("flex-1 rounded-md py-1.5 text-xs font-semibold capitalize", subPrefs.background === b ? "bg-accent" : "bg-white/10 hover:bg-white/20")}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function defaultSubIndex(subs: SubtitleTrack[]) {
  if (!subs.length) return -1;
  const def = subs.findIndex((s) => s.default);
  if (def >= 0) return def;
  const en = subs.findIndex((s) => /english/i.test(s.lang));
  return en >= 0 ? en : 0;
}

function langCode(label: string) {
  const map: Record<string, string> = {
    english: "en", spanish: "es", portuguese: "pt", french: "fr", german: "de", italian: "it",
    arabic: "ar", russian: "ru", indonesian: "id", thai: "th", vietnamese: "vi", hindi: "hi",
  };
  const key = label.toLowerCase().split(/[\s(-]/)[0];
  return map[key] ?? key.slice(0, 2);
}

function qualityLabel(levels: Level[], level: number, active: number) {
  if (level >= 0 && levels[level]) return `${levels[level].height}p`;
  return active >= 0 && levels[active] ? `Auto (${levels[active].height}p)` : "Auto";
}

function CtrlButton({
  label,
  onClick,
  children,
  className,
  active,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white",
        active && "text-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SkipButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fade-in absolute bottom-24 right-4 z-10 flex items-center gap-2 rounded-lg border border-white/30 bg-black/70 px-5 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white hover:text-black md:right-6"
    >
      {children}
    </button>
  );
}

function MenuRow({ children, value, icon, onClick }: { children: ReactNode; value?: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-white/10">
      <span className="text-dim">{icon}</span>
      <span className="flex-1 text-left">{children}</span>
      <span className="truncate text-xs text-muted">{value}</span>
      <ChevronRight className="size-4 text-dim" />
    </button>
  );
}

function MenuBack({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5 font-semibold hover:bg-white/10">
      <ChevronLeft className="size-4" /> {children}
    </button>
  );
}

function MenuOption({ children, selected, onClick }: { children: ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-white/10">
      <span>{children}</span>
      {selected && <Check className="size-4 text-accent" />}
    </button>
  );
}
