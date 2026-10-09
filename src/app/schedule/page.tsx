import type { Metadata } from "next";
import { ScheduleView } from "@/components/schedule/schedule-view";
import { getSchedule } from "@/lib/anilist";
import { getOverrides } from "@/lib/content";

export const metadata: Metadata = { title: "Airing Schedule" };
export const dynamic = "force-dynamic";

/** A day either side of now covers every timezone's "today". */
function scheduleWindow() {
  const now = Math.floor(Date.now() / 1000);
  const from = now - (now % 3600) - 86400;
  return { from, to: from + 9 * 86400 };
}

export default async function SchedulePage() {
  const { from, to } = scheduleWindow();
  const [items, overrides] = await Promise.all([getSchedule(from, to), getOverrides()]);
  const slim = items
    .filter((s) => !overrides.hidden.has(s.anime.id))
    .map((s) => ({ ...s, anime: { ...s.anime, description: null } }));
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight md:text-3xl">Airing Schedule</h1>
      <p className="mt-1 text-sm text-muted">Times are shown in your local timezone.</p>
      <ScheduleView items={slim} />
    </div>
  );
}
