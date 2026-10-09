"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers";
import { SyncBanner } from "@/components/ui/sync-banner";
import { useSaveSettings, useSettings } from "@/lib/hooks";
import type { StreamSource, UserSettings } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { settings, loaded } = useSettings();
  const save = useSaveSettings();
  const { user } = useAuth();
  const set = (patch: Partial<UserSettings>) => save.mutate(patch);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 pt-6 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">Settings</h1>
      <SyncBanner />

      <Section title="Playback">
        <Row label="Default audio" hint="Used when you open an episode.">
          <Segmented
            value={settings.default_type}
            options={[
              ["sub", "Sub"],
              ["dub", "Dub"],
            ]}
            onChange={(v) => set({ default_type: v as UserSettings["default_type"] })}
          />
        </Row>
        <Row label="Default source">
          <select
            value={settings.default_source}
            onChange={(e) => set({ default_source: e.target.value as StreamSource })}
            className="h-10 rounded-lg border border-line bg-bg px-3 text-sm"
            disabled={!loaded}
          >
            <option value="anikoto">Anikoto</option>
            <option value="animeheaven">AnimeHeaven</option>
            <option value="desidub">DesiDub (Hindi)</option>
          </select>
        </Row>
        <Row label="Preferred server" hint="Leave empty to use the source's first server.">
          <ServerInput value={settings.default_server ?? ""} onSave={(v) => set({ default_server: v || null })} />
        </Row>
        <Toggle label="Autoplay next episode" checked={settings.autoplay_next} onChange={(v) => set({ autoplay_next: v })} />
        <Toggle
          label="Skip intros automatically"
          hint="Only works where the source provides intro timestamps."
          checked={settings.skip_intro}
          onChange={(v) => set({ skip_intro: v })}
        />
        <Toggle
          label="Update my list automatically"
          hint="First play moves a show to Watching; finishing the last episode marks it Completed."
          checked={settings.auto_status}
          onChange={(v) => set({ auto_status: v })}
        />
      </Section>

      <Section title="Subtitles">
        <Toggle
          label="Show subtitles by default"
          checked={settings.subtitle_prefs.enabled}
          onChange={(v) => set({ subtitle_prefs: { ...settings.subtitle_prefs, enabled: v } })}
        />
        <Row label="Size">
          <Segmented
            value={settings.subtitle_prefs.size}
            options={[
              ["sm", "S"],
              ["md", "M"],
              ["lg", "L"],
              ["xl", "XL"],
            ]}
            onChange={(v) => set({ subtitle_prefs: { ...settings.subtitle_prefs, size: v as UserSettings["subtitle_prefs"]["size"] } })}
          />
        </Row>
        <Row label="Background">
          <Segmented
            value={settings.subtitle_prefs.background}
            options={[
              ["none", "None"],
              ["dim", "Dim"],
              ["solid", "Solid"],
            ]}
            onChange={(v) =>
              set({ subtitle_prefs: { ...settings.subtitle_prefs, background: v as UserSettings["subtitle_prefs"]["background"] } })
            }
          />
        </Row>
        <div
          className="player flex aspect-[21/6] items-end justify-center rounded-lg bg-[linear-gradient(135deg,#2b3a55,#1a1a24)] pb-4"
          data-sub-size={settings.subtitle_prefs.size}
          data-sub-bg={settings.subtitle_prefs.background}
        >
          <span
            className={cn(
              "px-2 py-0.5 text-white [text-shadow:0_1px_3px_rgba(0,0,0,.9)]",
              { sm: "text-sm", md: "text-base", lg: "text-xl", xl: "text-2xl" }[settings.subtitle_prefs.size],
              { none: "", dim: "bg-black/45", solid: "bg-black/85" }[settings.subtitle_prefs.background],
            )}
          >
            Subtitle preview
          </span>
        </div>
      </Section>

      {user && <DangerZone />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-dim">{title}</h2>
      <div className="space-y-1 rounded-xl bg-elev p-2 ring-1 ring-white/5">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-dim">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row label={label} hint={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-white/20")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </Row>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[][]; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg bg-bg p-0.5 ring-1 ring-line">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cn("min-w-11 rounded-md px-3 py-1.5 text-sm font-medium", value === v ? "bg-accent text-white" : "text-muted hover:text-fg")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function ServerInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(v.trim());
      }}
    >
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="e.g. HD-1"
        maxLength={40}
        className="h-10 w-32 rounded-lg border border-line bg-bg px-3 text-sm"
      />
      <button type="submit" className="h-10 rounded-lg bg-elev-2 px-3 text-sm font-semibold hover:bg-white/15">
        Save
      </button>
    </form>
  );
}

function DangerZone() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't delete the account.");
      return;
    }
    await signOut();
    router.replace("/");
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-danger">Danger zone</h2>
      <div className="space-y-3 rounded-xl bg-danger/5 p-5 ring-1 ring-danger/30">
        <p className="text-sm font-medium">Delete account</p>
        <p className="text-sm text-muted">This permanently removes your profile, lists, favorites and history. Type DELETE to confirm.</p>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-bg px-3 text-sm"
            aria-label="Type DELETE to confirm"
          />
          <button
            type="button"
            disabled={text !== "DELETE" || busy}
            onClick={del}
            className="h-10 rounded-lg bg-danger px-4 text-sm font-semibold text-black disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
