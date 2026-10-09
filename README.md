# AniBeast

Netflix-style anime streaming and tracking app. Next.js 16 (App Router) + Supabase, with the AnimeVault scraper for streams and AniList for metadata.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run db:migrate           # creates tables, RLS policies and the admin hook
npm run dev                  # http://localhost:3000
```

If port 3000 is taken, run `npm run dev -- -p 3100`. Then add `http://localhost:3100/**` to Supabase → Authentication → URL Configuration → Redirect URLs, or email and Google sign-in links won't come back to your dev server.

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## How it fits together

| Data | Source | Where |
|---|---|---|
| Rows, search, filters, seasonal, top, schedule, detail, characters | AniList GraphQL | `src/lib/anilist.ts` |
| Episodes, servers, stream URLs, artwork (TMDB logo/backdrop), theme songs | Scraper API | `src/lib/scraper.ts` |
| Accounts, lists, favorites, progress, history, settings, admin data | Supabase | `src/lib/tracking.ts`, `supabase/migrations/` |

- **Caching.** Every upstream call goes through `src/lib/cache.ts`. That gives you an in-memory cache with stale-while-revalidate and de-duplication of identical in-flight requests. If Upstash is configured, it adds a shared Redis layer for long-lived entries. AniList currently allows 30 requests/min, so the cache matters.
- **Video.** The player loads `hlsProxyUrl` / `streamUrl` straight from the scraper's proxy. Video bytes never pass through this app.
- **Fallbacks.** When a source fails, the watch page tries the next server, then AnimeHeaven, then the embed iframe.
- **Guests.** Guests track progress, lists and history in localStorage. It's merged into their account when they sign in.
- **Admin.** The admin panel lives at `/admin`. Non-admins get a 404, both in `src/proxy.ts` and in each page. The account matching `ADMIN_EMAIL` becomes admin on signup, or when `db:migrate` runs.

## Deploy to Railway

1. Push to GitHub and create a Railway service from the repo. Railway detects Next.js; build `npm run build`, start `npm run start`.
2. Paste the variables from `.env.local` into the service's Variables. `DATABASE_URL` isn't needed at runtime. Set `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Add the production domain in two places:
   - Supabase → URL Configuration: the Site URL, plus `https://your-domain/**` in Redirect URLs.
   - Google Cloud OAuth client: Authorized JavaScript origins.
4. `NEXT_PUBLIC_*` variables are baked in at build time. Redeploy after changing them.

## Scraper rate limit

The scraper allows 60 requests/min per IP, and every user shares this server's IP. Patch the scraper's `express-rate-limit` setup so requests carrying the key skip the limit:

```js
skip: (req) => !!process.env.INTERNAL_API_KEY && req.get("x-api-key") === process.env.INTERNAL_API_KEY,
```

Then set the same value as `INTERNAL_API_KEY` on the scraper and `SCRAPER_API_KEY` here.
