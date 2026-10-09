/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Avatar } from "@/components/ui/avatar";
import { SUPABASE_ANON_KEY, SUPABASE_ENABLED, SUPABASE_URL } from "@/lib/env";
import type { ListEntry } from "@/lib/types";

const LABELS: Record<string, string> = { watching: "Watching", completed: "Completed", plan: "Plan to Watch", dropped: "Dropped" };

async function load(username: string) {
  if (!SUPABASE_ENABLED || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) return null;
  // Anonymous client: RLS only exposes profiles that opted in to being public.
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: profile } = await db
    .from("public_profiles")
    .select("id, username, avatar_url, bio, created_at")
    .ilike("username", username)
    .maybeSingle();
  if (!profile) return null;
  const [{ data: list }, { data: favs }] = await Promise.all([
    db.from("list_entries").select("*").eq("user_id", profile.id).order("updated_at", { ascending: false }).limit(500),
    db.from("favorites").select("anilist_id, title, poster").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(50),
  ]);
  return { profile, list: (list ?? []) as ListEntry[], favs: favs ?? [] };
}

export async function generateMetadata({ params }: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username}'s anime list`, robots: { index: false } };
}

export default async function PublicProfile({ params }: PageProps<"/u/[username]">) {
  const data = await load((await params).username);
  if (!data) notFound();
  const { profile, list, favs } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 pt-6 md:px-8">
      <div className="flex items-center gap-5">
        <Avatar src={profile.avatar_url} name={profile.username} size={80} />
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold md:text-3xl">{profile.username}</h1>
          {profile.bio && <p className="mt-1 text-sm text-muted">{profile.bio}</p>}
          <p className="mt-1 text-xs text-dim">Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        </div>
      </div>

      {favs.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Favorites</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
            {favs.map((f) => (
              <Link key={f.anilist_id} href={`/anime/${f.anilist_id}`} title={f.title}>
                <img src={f.poster ?? ""} alt={f.title} loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-white/5 hover:ring-accent/60" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {(["watching", "completed", "plan", "dropped"] as const).map((status) => {
        const items = list.filter((e) => e.status === status);
        if (!items.length) return null;
        return (
          <section key={status}>
            <h2 className="mb-3 font-semibold">
              {LABELS[status]} <span className="text-sm font-normal text-dim">({items.length})</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl bg-elev ring-1 ring-white/5">
              {items.map((e) => (
                <li key={e.anilist_id}>
                  <Link href={`/anime/${e.anilist_id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-elev-2">
                    <img src={e.poster ?? ""} alt="" loading="lazy" className="h-12 w-9 shrink-0 rounded object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-dim">
                      {e.progress}/{e.episodes_total ?? "?"}
                    </span>
                    {e.score ? <span className="w-8 shrink-0 text-right text-sm font-semibold">{e.score}</span> : <span className="w-8" />}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
