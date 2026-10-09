import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MediaFormat, MediaSeason, MediaStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const FORMAT_LABEL: Record<MediaFormat, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
};

export function formatLabel(f: string | null | undefined) {
  if (!f) return null;
  return FORMAT_LABEL[f as MediaFormat] ?? f;
}

const STATUS_LABEL: Record<MediaStatus, string> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
};

export function statusLabel(s: string | null | undefined) {
  if (!s) return null;
  return STATUS_LABEL[s as MediaStatus] ?? s;
}

export function seasonLabel(s: MediaSeason | string | null | undefined) {
  if (!s) return null;
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function formatTime(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(s).padStart(2, "0")}`;
}

export function formatCountdown(seconds: number) {
  if (seconds <= 0) return "Aired";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function compactNumber(n: number | null | undefined) {
  if (n == null) return null;
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (diff < 60) return "just now";
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), "day");
  return new Date(iso).toLocaleDateString();
}

export function animeHref(id: number) {
  return `/anime/${id}`;
}

export function watchHref(id: number, ep = 1) {
  return `/watch/${id}/${ep}`;
}

export function toInt(v: string | string[] | undefined | null, fallback: number | null = null) {
  const s = Array.isArray(v) ? v[0] : v;
  const n = s == null ? NaN : parseInt(s, 10);
  return Number.isFinite(n) ? n : fallback;
}
