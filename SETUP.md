# AniBeast — Setup Guide (keys and accounts)

When you finish, you'll have a filled-in `.env.local` file in this folder, plus Google login and email working in Supabase.
It takes about 30 minutes. Do the steps in order.

**Before you start:** in this folder, copy `.env.example` to a new file named `.env.local`. Paste each value into `.env.local` as you get it.
Never share `.env.local` publicly, and never commit it to Git.

---

## Step 1 — Create the Supabase project (≈5 min)

1. Go to https://supabase.com and sign in with GitHub or email.
2. Click **New project**.
   - **Organization:** your default one.
   - **Project name:** `anibeast`
   - **Database password:** click **Generate a password**, then **copy it somewhere safe**. You need it in Step 3.
   - **Region:** pick the one closest to your users. Railway's scraper runs in Singapore (`sin1`), so **Southeast Asia (Singapore)** is a good choice.
3. Click **Create new project** and wait 1–2 minutes for it to finish setting up.

## Step 2 — Supabase URL and API keys

1. In the left sidebar, open **Project Settings** (the gear icon), then **API Keys**.
   - In some dashboards it's **Project Settings → API**.
2. Copy these values into `.env.local`:

| Dashboard shows | Put it in |
|---|---|
| **Project URL** (`https://abcdxyz.supabase.co`), shown under **Data API** or at the top of the API page | `NEXT_PUBLIC_SUPABASE_URL` |
| **Publishable key** (`sb_publishable_...`), or on the **Legacy API keys** tab the **anon public** key (`eyJ...`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **Secret key** (`sb_secret_...`, click **Reveal**), or on the **Legacy API keys** tab the **service_role** key | `SUPABASE_SERVICE_ROLE_KEY` |

> The secret / service_role key bypasses all database security. Never put it in front-end code or a screenshot.

## Step 3 — Database connection string (lets me create the tables)

1. Click the **Connect** button at the top of the Supabase dashboard.
2. Under **Connection String**, choose **Session pooler**. Don't choose Direct, which may not work on IPv4 networks.
3. Copy the URI. It looks like this:
   ```
   postgresql://postgres.abcdxyz:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```
4. Replace `[YOUR-PASSWORD]` with the database password from Step 1, removing the brackets. Put the result in `DATABASE_URL`.
   - **Lost the password?** Go to Project Settings → Database → **Reset database password**.
   - **Does your password contain `@`, `#`, `/` or `?`?** Reset it to one that only uses letters and numbers. Those characters break the URL.

## Step 4 — Google login (≈10 min)

### 4a. Copy the Supabase callback URL
1. In Supabase, go to **Authentication → Sign In / Providers**, and click **Google**.
2. Copy the **Callback URL (for OAuth)** shown there. It looks like `https://abcdxyz.supabase.co/auth/v1/callback`.
   Leave this tab open.

### 4b. Create the Google OAuth client
1. Go to https://console.cloud.google.com and sign in.
2. Use the project dropdown at the top-left: **New Project**, name it `AniBeast`, then **Create**, and make sure it's selected.
3. Open the menu, go to **APIs & Services → OAuth consent screen**. Newer consoles call this **Google Auth Platform**. Click **Get started**.
   - **App name:** `AniBeast`; **User support email:** your email.
   - **Audience:** **External**.
   - **Contact email:** your email. Agree to the policy and click **Create**.
4. Go to **Clients** (or **Credentials → Create credentials → OAuth client ID**).
   - **Application type:** **Web application**; **Name:** `AniBeast Web`.
   - Under **Authorized JavaScript origins**, add:
     - `http://localhost:3000`
     - your production domain later, for example `https://anibeast.xyz`
   - Under **Authorized redirect URIs**, add the Supabase callback URL from 4a.
   - Click **Create**.
5. A dialog shows the **Client ID** and **Client Secret**. Copy both.
6. Go to **Audience** and click **Publish app**. While the app is unpublished, only listed test users can log in.

### 4c. Turn on Google in Supabase
1. Back on the Supabase Google provider page, switch **Enable Sign in with Google** on.
2. Paste the **Client ID** and **Client Secret**, then click **Save**.

These two values stay in Supabase. You don't need to put them in `.env.local`.

## Step 5 — Supabase URL settings

1. In Supabase, go to **Authentication → URL Configuration**.
2. Set **Site URL** to `http://localhost:3000`. Change it to your real domain at deploy time.
3. Under **Redirect URLs**, click **Add URL** and add:
   - `http://localhost:3000/**`
   - your production domain later, for example `https://anibeast.xyz/**`
4. Click **Save**.

Also check **Authentication → Sign In / Providers → Email**: it should be enabled, with **Confirm email** turned on.

## Step 6 — Scraper API key (skip the 60 requests/minute limit)

Your scraper allows 60 requests per minute per IP. Every request from AniBeast's server comes from one IP, so all users share that limit. A secret key lets the server skip it.

1. Generate a random key in a terminal:
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Put the output in `SCRAPER_API_KEY`.
2. In the **scraper's** code, find where `express-rate-limit` is set up and add the `skip` line:
   ```js
   const limiter = rateLimit({
     windowMs: 60 * 1000,
     limit: 60,
     // ...existing options...
     skip: (req) =>
       !!process.env.INTERNAL_API_KEY &&
       req.get('x-api-key') === process.env.INTERNAL_API_KEY,
   });
   ```
3. In Railway, open the scraper service, go to **Variables**, add `INTERNAL_API_KEY`, and give it the **same value**. Railway redeploys the service automatically.
4. To test it, run this request many times quickly:
   ```
   curl -I -H "x-api-key: YOUR_KEY" "https://animevault.up.railway.app/api/health"
   ```
   It should never return `429`.

The video proxy stays rate-limited per viewer, which is fine because browsers call it directly.

**Can't edit the scraper?** Leave `SCRAPER_API_KEY` blank. The app still works, but only for a few users at a time.

## Step 7 — App settings

```
SCRAPER_BASE_URL=https://animevault.up.railway.app
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ADMIN_EMAIL=you@example.com
```
`ADMIN_EMAIL` must be the exact email you'll sign up with. That account gets the admin role automatically.

## Step 8 — GitHub repository (≈3 min)

Railway deploys from GitHub, so the code needs a repo.

1. Go to https://github.com/new and sign in.
2. Fill in:
   - **Repository name:** `anibeast`
   - **Visibility:** **Private** (recommended)
   - **Do not** tick "Add a README", ".gitignore" or "license". The repo must be empty.
3. Click **Create repository** and copy its URL, for example `https://github.com/YOUR-USERNAME/anibeast.git`.
4. Send me that URL. This is not an env variable.

**Pushing:** git on this PC is already set up as `sainath1569`. The first time I push, Windows opens a browser window asking you to sign in to GitHub. Approve it once and it's remembered.
If the repo is under a different GitHub account than `sainath1569`, tell me.

## Step 9 — Railway (≈5 min, needed at deploy time)

You already use Railway for the scraper, so this is the same account.

1. Go to https://railway.com/dashboard, click **New** (or **+ Create**), then **GitHub Repo**.
   - If it asks, click **Configure GitHub App** and allow access to the `anibeast` repo.
2. Select `anibeast`. If the repo is still empty, do this after my first push.
3. Open the new service, go to **Variables**, then **Raw Editor**, and paste the whole contents of `.env.local`.
   Change `NEXT_PUBLIC_SITE_URL` to the production URL.
4. Go to **Settings → Networking → Generate Domain** to get a free `anibeast-production.up.railway.app`, or click **Custom Domain** to use your own.
5. Put that domain back into:
   - Supabase → Authentication → URL Configuration (Site URL and Redirect URLs)
   - Google Cloud → your OAuth client → Authorized JavaScript origins

**Optional:** I can deploy and read build logs myself if you create a token at **Account Settings → Tokens → Create Token** and put it in `.env.local` as `RAILWAY_TOKEN`. Otherwise, you just push and Railway deploys automatically.

---

## What you do NOT need

| Thing | Why not |
|---|---|
| TMDB / AniList / Kitsu / MAL API keys | Your scraper already handles TMDB, Kitsu and MAL. AniList's public API needs no key. |
| Supabase JWT secret | Supabase checks login tokens itself |
| Supabase personal access token | `DATABASE_URL` is enough for migrations |
| Google Client ID/Secret in `.env.local` | They live only in the Supabase dashboard |
| Cloudflare | Optional, only after you have a custom domain |

---

## Optional (can be done later)

### A. Email sending with Resend (recommended before launch)
Supabase's built-in email only sends a few messages per hour, which isn't enough for signup confirmations once real users arrive.
1. Sign up at https://resend.com.
2. Go to **Domains → Add Domain**, enter your domain, and add the DNS records it shows at your domain registrar (or in Cloudflare). Wait until it shows **Verified**.
   Without a verified domain, Resend only sends to your own email.
3. Go to **API Keys → Create API Key**. Copy it into `RESEND_API_KEY`.
4. In Supabase, go to **Project Settings → Authentication → SMTP Settings**, enable custom SMTP, and enter:
   - Host `smtp.resend.com`, Port `465`, Username `resend`, Password = the Resend API key
   - Sender email `no-reply@yourdomain.com`, Sender name `AniBeast`

### B. Sentry (error tracking)
1. Sign up at https://sentry.io and create a project with the **Next.js** platform.
2. Copy the **DSN** (`https://...@o123.ingest.sentry.io/456`) into `NEXT_PUBLIC_SENTRY_DSN`.

### C. Redis
Skip this for now. You only need it if you run more than one copy of the app on Railway.

### D. Custom domain
Any registrar works (Namecheap, Cloudflare, Porkbun). Without one, Railway's free `*.up.railway.app` domain is fine.

---

## Checklist — tell me when these are done

- [ ] `.env.local` exists in this folder with Supabase URL, anon key, service role key, `DATABASE_URL`
- [ ] `SCRAPER_API_KEY` set and the scraper patched (or you've told me you can't do it)
- [ ] `ADMIN_EMAIL` set
- [ ] Google provider enabled in Supabase
- [ ] Site URL and redirect URLs saved in Supabase
- [ ] Empty GitHub repo created; URL sent to me
- [ ] Railway: (now or at deploy) service connected to the repo; optional `RAILWAY_TOKEN`
- [ ] Tell me whether to include the `desidub` source
