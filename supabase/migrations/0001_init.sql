-- AniBeast schema: profiles, tracking, admin tables and row level security.
-- Safe to re-run: every object is created idempotently.

create extension if not exists pgcrypto;

-- ── Types ───────────────────────────────────────────────

do $$ begin
  create type public.list_status as enum ('watching', 'completed', 'plan', 'dropped');
exception when duplicate_object then null; end $$;

-- ── Profiles ────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  role text not null default 'user' check (role in ('user', 'admin')),
  is_public boolean not null default false,
  banned boolean not null default false,
  banned_reason text,
  created_at timestamptz not null default now()
);

-- Admin check used by policies. SECURITY DEFINER so it can read profiles
-- without recursing through the profiles policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not banned
  );
$$;

-- Whether a user's lists are public. SECURITY DEFINER for the same reason.
create or replace function public.is_public_profile(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and is_public and not banned);
$$;

-- Users may edit their own profile but never their role or ban status.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.banned is distinct from old.banned
      or new.banned_reason is distinct from old.banned_reason)
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'not allowed to change role or ban status';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ── Tracking ────────────────────────────────────────────

create table if not exists public.list_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  anilist_id integer not null,
  mal_id integer,
  title text not null,
  poster text,
  format text,
  episodes_total integer,
  genres text[] not null default '{}',
  status public.list_status not null default 'plan',
  progress integer not null default 0 check (progress >= 0),
  score integer check (score between 1 and 10),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, anilist_id)
);
create index if not exists list_entries_user_status on public.list_entries (user_id, status, updated_at desc);

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  anilist_id integer not null,
  mal_id integer,
  title text not null,
  poster text,
  created_at timestamptz not null default now(),
  primary key (user_id, anilist_id)
);

create table if not exists public.watch_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  anilist_id integer not null,
  episode integer not null,
  position_sec integer not null default 0,
  duration_sec integer not null default 0,
  type text not null default 'sub' check (type in ('sub', 'dub')),
  source text,
  server text,
  completed boolean not null default false,
  title text,
  poster text,
  episodes_total integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, anilist_id, episode)
);
create index if not exists watch_progress_recent on public.watch_progress (user_id, updated_at desc);

create table if not exists public.watch_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  anilist_id integer not null,
  episode integer not null,
  title text,
  poster text,
  watched_at timestamptz not null default now()
);
create index if not exists watch_history_recent on public.watch_history (user_id, watched_at desc);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  default_type text not null default 'sub' check (default_type in ('sub', 'dub')),
  default_source text not null default 'anikoto',
  default_server text,
  autoplay_next boolean not null default true,
  skip_intro boolean not null default false,
  auto_status boolean not null default true,
  subtitle_prefs jsonb not null default '{"size":"md","background":"dim","enabled":true}',
  updated_at timestamptz not null default now()
);

-- ── Moderation and content ──────────────────────────────

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid references auth.users (id) on delete set null,
  anilist_id integer not null,
  episode integer,
  reason text not null check (reason in ('broken_video', 'wrong_episode', 'subtitles', 'audio', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);
create index if not exists reports_status on public.reports (status, created_at desc);

create table if not exists public.anime_overrides (
  anilist_id integer primary key,
  title text,
  hidden boolean not null default false,
  featured boolean not null default false,
  featured_order integer not null default 0,
  custom_ids jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id bigint generated always as identity primary key,
  message text not null check (char_length(message) <= 300),
  link text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_recent on public.admin_audit_log (created_at desc);

-- ── updated_at maintenance ──────────────────────────────

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['list_entries', 'watch_progress', 'user_settings', 'anime_overrides'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ── Private config (not exposed through the API) ────────

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.config (
  key text primary key,
  value text not null
);

-- ── New user bootstrap ──────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1),
    'user'), '[^a-zA-Z0-9_]', '', 'g'));
  if char_length(base) < 3 then base := base || 'user'; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;

  insert into public.profiles (id, username, avatar_url, role)
  values (
    new.id,
    candidate,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'),
    case when exists (
      select 1 from private.config c where c.key = 'admin_email' and lower(c.value) = lower(new.email)
    ) then 'admin' else 'user' end
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Public profile view (limited columns) ───────────────

create or replace view public.public_profiles
with (security_invoker = false) as
  select id, username, avatar_url, bio, created_at
  from public.profiles
  where is_public and not banned;

grant select on public.public_profiles to anon, authenticated;

-- ── Row level security ──────────────────────────────────

alter table public.profiles enable row level security;
alter table public.list_entries enable row level security;
alter table public.favorites enable row level security;
alter table public.watch_progress enable row level security;
alter table public.watch_history enable row level security;
alter table public.user_settings enable row level security;
alter table public.reports enable row level security;
alter table public.anime_overrides enable row level security;
alter table public.announcements enable row level security;
alter table public.admin_audit_log enable row level security;

do $$
declare r record;
begin
  -- Drop existing policies so this file can be re-run.
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in (
    'profiles','list_entries','favorites','watch_progress','watch_history','user_settings',
    'reports','anime_overrides','announcements','admin_audit_log') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: own row, or admin. Public pages read through public_profiles.
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Per-user tables: owner only.
create policy list_owner on public.list_entries for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy fav_owner on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy progress_owner on public.watch_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy history_owner on public.watch_history for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy settings_owner on public.user_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Lists of public profiles are readable by anyone.
create policy list_public_read on public.list_entries for select using (public.is_public_profile(user_id));
create policy fav_public_read on public.favorites for select using (public.is_public_profile(user_id));

-- reports: any signed-in user may file; admins read and update.
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_admin_select on public.reports for select using (public.is_admin());
create policy reports_admin_update on public.reports for update using (public.is_admin());
create policy reports_admin_delete on public.reports for delete using (public.is_admin());

-- overrides and announcements: public read, admin write.
create policy overrides_read on public.anime_overrides for select using (true);
create policy overrides_admin on public.anime_overrides for all using (public.is_admin()) with check (public.is_admin());
create policy announcements_read on public.announcements for select using (true);
create policy announcements_admin on public.announcements for all using (public.is_admin()) with check (public.is_admin());

-- audit log: admin only.
create policy audit_admin_select on public.admin_audit_log for select using (public.is_admin());
create policy audit_admin_insert on public.admin_audit_log for insert with check (public.is_admin() and admin_id = auth.uid());
