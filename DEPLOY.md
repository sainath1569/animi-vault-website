# Deploying AniBeast

This guide takes AniBeast from GitHub to a live URL in about 15 minutes.

## What you're deploying

AniBeast is a **full-stack Next.js app**, not a static site. Pages are rendered on the server, and the app has its own API routes and login checks. It needs a host that runs Node.js, such as **Railway** or **Vercel**. Static-only hosts like GitHub Pages or Netlify Drop won't work.

| Part | Where it runs | Your job |
|---|---|---|
| Website + backend (this repo) | Railway or Vercel | **Deploy it (this guide)** |
| Database and login | Supabase (already hosted) | Update two URL settings |
| Video/episode scraper | Already live on Railway | Nothing |
| Anime metadata | AniList public API | Nothing |

## Before you start

You need:
- Access to the GitHub repo `sainath1569/animi-vault-website`
- The values from the owner's `.env.local` file. Get them privately; never post them in chat groups or commit them to Git.
- Access to the Supabase project and the Google Cloud OAuth client (for step 4)

---

## Step 1 — Create the service

Pick **one** host.

### Option A: Railway (recommended)
1. Go to https://railway.com/dashboard → **New** → **GitHub Repo**.
2. If asked, click **Configure GitHub App** and allow access to `animi-vault-website`.
3. Select the repo. Railway detects Next.js and runs `npm run build`, then `npm run start`. You don't need to change any build settings.

### Option B: Vercel
1. Go to https://vercel.com/new and import `animi-vault-website`.
2. Vercel detects Next.js automatically. Leave the build settings as they are.

The first build may fail because the variables aren't set yet. That's expected; step 2 fixes it.

## Step 2 — Add the environment variables

- **Railway:** open the service → **Variables** → **Raw Editor**.
- **Vercel:** Project → **Settings** → **Environment Variables**. You can also paste them in during import.

Paste these, filling in values from `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SCRAPER_BASE_URL=https://animevault.up.railway.app
SCRAPER_API_KEY=
ADMIN_EMAIL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_SITE_URL=https://YOUR-LIVE-DOMAIN
```

| Variable | What it is | Required? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key, used on the server only | Yes |
| `SCRAPER_BASE_URL` | Address of the video scraper | Yes |
| `NEXT_PUBLIC_SITE_URL` | The live site's URL. **Must not be `localhost`.** | Yes |
| `ADMIN_EMAIL` | The account with this email gets the admin panel | Yes |
| `SCRAPER_API_KEY` | Lets the app skip the scraper's rate limit (see below) | Optional |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Shared cache | Optional (recommended on Vercel) |

**Don't add** `DATABASE_URL`, `SUPABASE_DB_PASSWORD` or `RAILWAY_TOKEN`. The live site doesn't use them; they're only for running database migrations from a laptop.

## Step 3 — Get the domain, then redeploy

1. Get the public URL:
   - **Railway:** **Settings** → **Networking** → **Generate Domain**. This gives you something like `anibeast-production.up.railway.app`.
   - **Vercel:** the URL is shown on the project page, for example `anibeast.vercel.app`.
   - Using a custom domain? Add it in the same place and follow the DNS instructions shown.
2. Set `NEXT_PUBLIC_SITE_URL` to that URL, with `https://` and no trailing slash.
3. **Redeploy.**

> Any variable starting with `NEXT_PUBLIC_` is built into the app when it builds. Whenever you change one, you must redeploy for it to take effect.

## Step 4 — Tell Supabase and Google about the new domain

Without this step, sign-up emails and Google login will send people back to `localhost` or fail.

1. **Supabase** → **Authentication** → **URL Configuration**
   - **Site URL:** `https://your-domain`
   - **Redirect URLs:** add `https://your-domain/**`
   - Click **Save**.
2. **Google Cloud Console** → **APIs & Services** → **Credentials** (or **Google Auth Platform** → **Clients**) → the AniBeast web client
   - **Authorized JavaScript origins:** add `https://your-domain`
   - Leave the redirect URI alone. It points at Supabase, not at the site.
   - Click **Save**.

## Step 5 — Database

Run the migrations whenever new files are added to `supabase/migrations/`, or when you switch to a fresh Supabase project. Running them again is safe. Do it from a laptop that has `.env.local` with `DATABASE_URL` set:

```bash
npm install
npm run db:migrate
```

> `0002_admin_email_sync.sql` is new. If nobody has run `npm run db:migrate` since it was added, run it once before deploying. Otherwise `ADMIN_EMAIL` won't apply, and the logs will show `[admin] Couldn't apply ADMIN_EMAIL`.

## Step 6 — Email verification codes

Sign-up is confirmed with a 6-digit code typed on the site, not a link. In the Supabase dashboard:

1. **Authentication** → **Email Templates** → **Confirm signup**
   - **Subject:** `Your AniBeast verification code`
   - **Body:** paste in the contents of `supabase/templates/confirm-signup.html`. It must contain `{{ .Token }}`.
2. **Authentication** → **Providers** → **Email**: set **Email OTP Expiration** to `600` seconds.
3. **Custom SMTP** (**Project Settings** → **Authentication** → **SMTP**): Supabase's built-in email **only reaches your project's team members** and sends just a few per hour. **Real users won't get their codes** until you set up Resend or another SMTP provider. See option A of [SETUP.md](SETUP.md).

---

## Check that it works

Open the live URL and go through this list:

- [ ] The homepage loads with anime rows. This means AniList is working.
- [ ] Opening an anime and playing an episode works. This means the scraper is working.
- [ ] Email sign-up sends a code, and entering it signs you in. Test with an email that isn't on the Supabase team, so you know SMTP works.
- [ ] "Continue with Google" works and returns to the live site.
- [ ] Signing in with the `ADMIN_EMAIL` account and opening `/admin` shows the admin panel.

## If something breaks

Check the logs first:
- **Railway:** service → **Deployments** → the latest one → **View logs**
- **Vercel:** Project → **Deployments** → the latest one → **Logs**

| Symptom | Likely cause |
|---|---|
| Build fails | A required variable is missing. Check step 2, then redeploy. |
| Sign-up code email never arrives | Custom SMTP isn't set up (step 6), or the Supabase email rate limit was hit |
| `/admin` shows 404 for the admin account | `ADMIN_EMAIL` doesn't exactly match the account's email, or migration `0002` wasn't run (step 5) |
| Login redirects to `localhost` | `NEXT_PUBLIC_SITE_URL` is wrong or wasn't redeployed, or the Supabase Site URL wasn't updated |
| Google login fails with "redirect_uri_mismatch" or an "origin" error | The domain is missing from Google's Authorized JavaScript origins |
| Login works, but lists and progress don't save | The Supabase keys are wrong or have extra spaces |
| Videos fail when several people watch at once | Scraper rate limit; see below |
| Changed a variable but nothing happened | You didn't redeploy |

## Scraper rate limit

The scraper allows 60 requests per minute per IP address. All visitors' requests go out through this one server, so they share that limit. With a handful of people watching at the same time, videos can start failing.

To fix it:
1. Generate a key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Patch the scraper so requests carrying that key skip the limit. See step 6 of [SETUP.md](SETUP.md).
3. Set the same value as `INTERNAL_API_KEY` on the scraper service and as `SCRAPER_API_KEY` on this app, then redeploy.

## Updating the live site

Push to the `main` branch on GitHub. Railway and Vercel both redeploy automatically.
