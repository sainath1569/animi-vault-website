# AniBeast — Implementation Plan

Based on `AniBeast.txt` (spec) and `apidocs.txt`, checked against the live scraper at
`https://animevault.up.railway.app` on 2026-10-09.

---

## 1. What the live API actually does (differs from the docs)

| Area | Docs say | Live API does | Impact |
|---|---|---|---|
| Search | `?query=` | `?q=` | BFF uses `q` |
| `/api/info` | search-like results | `?anilistId=` or `?malId=` → `episodeCount` + `siteIds` per source | Used for ID mapping and source availability |
| `/api/watch` | path `/watch/:source/:id/:ep/:type` | query `?anilistId=&ep=&type=&source=&server=` | BFF builds query strings |
| Watch response | `m3u8`, `embedUrl`, `note` | also `hlsProxyUrl`, `playbackMode`, `iframeOnly`, `streamUrl` (AnimeHeaven MP4 via `/api/proxy/video`), subtitles already proxied | Player picks mode from `playbackMode` / `iframeOnly` |
| Sources | anikoto, animeheaven | also **desidub** (and `zoro` site IDs) | Source switcher shows 3 sources |
| Intro/outro | timestamps | often `null` | Skip buttons appear only when data exists |
| Rate limit | not documented | **60 requests/min per IP on every route, including the HLS proxy** | See section 2 — most important constraint |
| CORS | — | `Access-Control-Allow-Origin: *` on proxy | Browser can play `hlsProxyUrl` directly |

Everything else I tested works: search, episodes, servers, watch (sub + dub, server switch, AnimeHeaven MP4), `/api/anime`, `/api/episode` (TMDB thumbnails + filler/recap), MAL search/videos, AniList season/banners/id, Kitsu, TMDB episode-thumb.

## 2. Key architecture decisions

1. **Rate limit vs. the BFF.** The spec routes all calls through Next.js on Railway, so every user shares one server IP and one 60/min budget. Opening the home page alone fires around 10 calls. Fix (needs your scraper source): accept an `X-API-Key` header that skips the limiter, or allow-list the app over Railway private networking. Without it the site falls over at a handful of concurrent users.
2. **Video bypasses the BFF.** Metadata and IDs go through `/api/*` in Next.js (cached, keys hidden). The player loads `hlsProxyUrl` / `streamUrl` **directly** from the scraper's proxy (CORS allows it). Each viewer then uses their own IP's rate limit, and video bytes don't pass through the app server twice. The scraper still pays the video egress on Railway.
3. **AniList ID is the primary key** (`/anime/[anilistId]`, `/watch/[anilistId]/[ep]`), because browse lists come from AniList and `/watch` takes `anilistId`. `mal_id` is stored alongside for MAL detail endpoints.
4. **AniList GraphQL is called directly from the server** for trending, popular, top, filters, seasonal and the schedule. No key needed. Its limit is 90/min, so results are cached with ISR and an in-memory LRU.
5. **Caching:** in-memory LRU plus request de-dup in the BFF from day one. Redis is optional, added later if you run more than one instance. TTLs: search 5m, details 12h, episodes 1h, schedule 5m, watch/servers 0 (tokens expire).

## 3. Stack

Next.js 15 (App Router) + TypeScript + Tailwind v4 · shadcn/ui · Framer Motion · Embla · TanStack Query · Vidstack player (built-in hls.js) · Supabase (`@supabase/ssr`, Postgres, Auth, RLS) · Zod for validating API responses · Railway deploy.

## 4. Routes

**Pages:** `/` home · `/search` · `/browse` (URL-driven filters) · `/seasonal` · `/top` · `/schedule` · `/anime/[id]` · `/watch/[id]/[ep]` · `/list` · `/history` · `/u/[username]` (public profile) · `/settings` · `/login` `/signup` `/auth/callback` · `/admin/*` (role-guarded in middleware and server components, plus RLS).

**BFF (`/api/*`):** `search`, `anime/[id]`, `anime/[id]/{characters,themes,videos,recs,pictures}`, `episodes/[id]`, `servers`, `watch`, `anilist/{trending,season,top,schedule,browse}`, `progress` (beacon target), `admin/*` (service role key, server only).

## 5. Build phases and what each delivers

| # | Phase | Deliverable you can click through |
|---|---|---|
| 1 | Foundation | App scaffold, dark design system, navbar + mobile tab bar, Supabase schema + RLS migrations, email + Google login, profile auto-creation |
| 2 | Browse | Home hero + rows, search with autocomplete, filters, seasonal, top, full detail page (episodes, characters, themes, trailer, recs) |
| 3 | Playback | Watch page: Vidstack player, HLS / MP4 / iframe fallback, sub/dub, source + server switch, subtitles + style menu, skip intro/outro, next/prev, episode drawer, auto-next, shortcuts, double-tap seek, PiP, prefetch next episode, MP4 download |
| 4 | Tracking | Progress saving (throttled + `sendBeacon`), Continue Watching, lists, favorites, history, auto status, guest localStorage merged on login |
| 5 | Schedule + polish | Weekday schedule with live countdowns, profile stats, settings, PWA, image and bundle tuning |
| 6 | Admin | Users / ban, reports queue, featured / hidden / ID overrides, announcements, scraper health, cache purge, audit log |
| 7 | Hardening | BFF rate limiting, error boundaries, Sentry, Lighthouse + mobile QA, deploy to Railway |

Every phase ends with `npm run build` passing and a browser check of the new screens.

## 6. Data model

As in the spec, section 5, with these additions:
- `list_entries.episodes_total` (for auto-complete) and `favorites`/`list_entries` storing `format` and `year` for card rendering without refetching.
- `watch_progress.source` and `server`, so resume uses the same stream.
- `user_settings.default_source` and `subtitle_prefs` defaults.
- `is_admin()` as `SECURITY DEFINER`, plus a trigger stopping users from changing their own `role` or `banned`.
- A `handle_new_user` trigger that creates `profiles` and `user_settings` rows on signup.
