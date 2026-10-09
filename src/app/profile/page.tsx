"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, ExternalLink, Film, Heart, ListChecks } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers";
import { Avatar } from "@/components/ui/avatar";
import { useFavorites, useList } from "@/lib/hooks";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const { user, profile, supabase, ready } = useAuth();
  const { data: list } = useList();
  const { data: favs } = useFavorites();
  const { data: watch } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      const { data } = await supabase!
        .from("watch_progress")
        .select("position_sec, duration_sec, completed")
        .eq("user_id", user!.id)
        .limit(10000);
      return data ?? [];
    },
    enabled: Boolean(user && supabase),
  });

  const stats = useMemo(() => {
    const seconds = (watch ?? []).reduce((sum, r) => sum + (r.completed ? r.duration_sec : r.position_sec), 0);
    const episodes = (watch ?? []).filter((r) => r.completed).length;
    const genreCount = new Map<string, number>();
    for (const e of list ?? []) {
      if (e.status === "dropped") continue;
      for (const g of e.genres ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    }
    const genres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return {
      hours: seconds / 3600,
      episodes,
      completed: (list ?? []).filter((e) => e.status === "completed").length,
      genres,
      maxGenre: genres[0]?.[1] ?? 1,
    };
  }, [watch, list]);

  if (!ready) return <div className="mx-auto max-w-4xl px-4 pt-10"><div className="skeleton h-40 rounded-2xl" /></div>;
  if (!user) {
    return (
      <div className="py-24 text-center">
        <Link href="/login?next=/profile" className="rounded-full bg-accent px-6 py-3 font-semibold text-white">
          Sign in to see your profile
        </Link>
      </div>
    );
  }

  const name = profile?.username ?? user.email?.split("@")[0] ?? "You";

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 pt-6 md:px-8">
      <div className="flex flex-wrap items-center gap-5">
        <Avatar src={profile?.avatar_url} name={name} size={88} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-[family-name:var(--font-display)] text-2xl font-bold md:text-3xl">{name}</h1>
          {profile?.bio && <p className="mt-1 text-sm text-muted">{profile.bio}</p>}
          {profile?.is_public && profile.username && (
            <Link href={`/u/${profile.username}`} className="mt-2 inline-flex items-center gap-1 text-sm text-accent hover:underline">
              View public profile <ExternalLink className="size-3.5" />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Clock className="size-5" />} label="Hours watched" value={stats.hours.toFixed(1)} />
        <Stat icon={<Film className="size-5" />} label="Episodes finished" value={String(stats.episodes)} />
        <Stat icon={<ListChecks className="size-5" />} label="Completed shows" value={String(stats.completed)} />
        <Stat icon={<Heart className="size-5" />} label="Favorites" value={String(favs?.length ?? 0)} />
      </div>

      {stats.genres.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dim">Top genres</h2>
          <div className="space-y-2 rounded-xl bg-elev p-5 ring-1 ring-white/5">
            {stats.genres.map(([g, n]) => (
              <div key={g} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 truncate">{g}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(n / stats.maxGenre) * 100}%` }} />
                </div>
                <span className="w-8 text-right tabular-nums text-dim">{n}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {profile && <EditProfile key={`${profile.id}:${profile.username}:${profile.is_public}`} />}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-elev p-4 ring-1 ring-white/5">
      <div className="text-accent">{icon}</div>
      <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-dim">{label}</p>
    </div>
  );
}

function EditProfile() {
  const { profile, supabase, user, refreshProfile } = useAuth();
  // Initialised from the profile; the parent re-keys this form when the profile changes.
  const [username, setUsername] = useState(profile?.username ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar_url ?? "");
  const [isPublic, setIsPublic] = useState(profile?.is_public ?? false);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "saved" | "error"; msg?: string }>({ kind: "idle" });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      return setState({ kind: "error", msg: "Username must be 3–24 letters, numbers or underscores." });
    }
    if (avatar && !/^https:\/\/\S+$/.test(avatar)) return setState({ kind: "error", msg: "Avatar must be an https:// image URL." });
    setState({ kind: "saving" });
    const { error } = await supabase
      .from("profiles")
      .update({ username, bio: bio.trim() || null, avatar_url: avatar.trim() || null, is_public: isPublic })
      .eq("id", user.id);
    if (error) {
      setState({ kind: "error", msg: error.code === "23505" ? "That username is taken." : error.message });
      return;
    }
    await refreshProfile();
    setState({ kind: "saved" });
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dim">Edit profile</h2>
      <form onSubmit={save} className="space-y-4 rounded-xl bg-elev p-5 ring-1 ring-white/5">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Username</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">Avatar URL</span>
          <input value={avatar} onChange={(e) => setAvatar(e.target.value)} placeholder="https://…" className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm" />
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Public profile</span>
            <span className="block text-xs text-dim">Let anyone with the link see your lists and favorites. Off by default.</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            onClick={() => setIsPublic((v) => !v)}
            className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", isPublic ? "bg-accent" : "bg-white/20")}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", isPublic ? "left-[22px]" : "left-0.5")} />
          </button>
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={state.kind === "saving"} className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60">
            {state.kind === "saving" ? "Saving…" : "Save changes"}
          </button>
          {state.kind === "saved" && <span className="text-sm text-ok">Saved</span>}
          {state.kind === "error" && <span className="text-sm text-danger">{state.msg}</span>}
        </div>
      </form>
    </section>
  );
}
