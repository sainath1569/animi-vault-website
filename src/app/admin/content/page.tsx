import Link from "next/link";
import { deleteOverride, saveOverride } from "../actions";
import { adminDb } from "@/lib/supabase/server";

export default async function AdminContent() {
  const db = await adminDb();
  const { data: rows } = await db
    .from("anime_overrides")
    .select("*")
    .order("featured", { ascending: false })
    .order("featured_order")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-elev p-5 ring-1 ring-white/5">
        <h2 className="font-semibold">Add or update a title</h2>
        <p className="mt-1 text-sm text-muted">
          Featured titles lead the home carousel (lowest order first). Hidden titles disappear from every list, page and stream.
        </p>
        <OverrideForm />
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Current overrides ({rows?.length ?? 0})</h2>
        <ul className="space-y-2">
          {(rows ?? []).map((r) => (
            <li key={r.anilist_id} className="rounded-xl bg-elev p-4 ring-1 ring-white/5">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/anime/${r.anilist_id}`} target="_blank" className="font-medium text-accent hover:underline">
                  {r.title || `AniList ${r.anilist_id}`}
                </Link>
                {r.featured && <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">Featured #{r.featured_order}</span>}
                {r.hidden && <span className="rounded bg-danger/20 px-2 py-0.5 text-xs text-danger">Hidden</span>}
                {Object.keys(r.custom_ids ?? {}).length > 0 && (
                  <code className="rounded bg-elev-2 px-2 py-0.5 text-xs">{JSON.stringify(r.custom_ids)}</code>
                )}
                <form action={deleteOverride} className="ml-auto">
                  <input type="hidden" name="anilistId" value={r.anilist_id} />
                  <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10">Remove</button>
                </form>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-dim">Edit</summary>
                <OverrideForm row={r} />
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function OverrideForm({
  row,
}: {
  row?: { anilist_id: number; title: string | null; hidden: boolean; featured: boolean; featured_order: number; custom_ids: Record<string, unknown> };
}) {
  return (
    <form action={saveOverride} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm">
        AniList ID
        <input
          name="anilistId"
          type="number"
          required
          defaultValue={row?.anilist_id}
          readOnly={Boolean(row)}
          className="mt-1 h-10 w-full rounded-lg border border-line bg-bg px-3"
        />
      </label>
      <label className="text-sm">
        Label (for your reference)
        <input name="title" defaultValue={row?.title ?? ""} className="mt-1 h-10 w-full rounded-lg border border-line bg-bg px-3" />
      </label>
      <label className="text-sm">
        Featured order
        <input name="featuredOrder" type="number" defaultValue={row?.featured_order ?? 0} className="mt-1 h-10 w-full rounded-lg border border-line bg-bg px-3" />
      </label>
      <label className="text-sm">
        Custom IDs (JSON)
        <input
          name="customIds"
          defaultValue={row && Object.keys(row.custom_ids ?? {}).length ? JSON.stringify(row.custom_ids) : ""}
          placeholder='{"malId": 123, "heavenId": "abc"}'
          className="mt-1 h-10 w-full rounded-lg border border-line bg-bg px-3 font-mono text-xs"
        />
      </label>
      <div className="flex items-center gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="featured" defaultChecked={row?.featured} className="accent-[var(--accent)]" /> Featured
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="hidden" defaultChecked={row?.hidden} className="accent-[var(--accent)]" /> Hidden
        </label>
      </div>
      <div className="sm:text-right">
        <button className="h-10 rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover">Save</button>
      </div>
    </form>
  );
}
