import { createAnnouncement, deleteAnnouncement, toggleAnnouncement } from "../actions";
import { adminDb } from "@/lib/supabase/server";

export default async function AdminAnnouncements() {
  const db = await adminDb();
  const { data: rows } = await db.from("announcements").select("*").order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <form action={createAnnouncement} className="space-y-3 rounded-xl bg-elev p-5 ring-1 ring-white/5">
        <h2 className="font-semibold">New announcement</h2>
        <p className="text-sm text-muted">The newest active announcement shows as a banner at the top of every page.</p>
        <input name="message" required maxLength={300} placeholder="Message" className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm" />
        <input name="link" placeholder="Optional link (https://…)" className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm" />
        <button className="h-10 rounded-lg bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover">Publish</button>
      </form>

      <ul className="space-y-2">
        {(rows ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-elev p-4 ring-1 ring-white/5">
            <span className={`size-2 rounded-full ${a.active ? "bg-ok" : "bg-dim"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{a.message}</p>
              <p className="text-xs text-dim">
                {new Date(a.created_at).toLocaleString()}
                {a.link ? ` · ${a.link}` : ""}
              </p>
            </div>
            <form action={toggleAnnouncement}>
              <input type="hidden" name="id" value={a.id} />
              <input type="hidden" name="active" value={String(!a.active)} />
              <button className="rounded-lg bg-elev-2 px-3 py-1.5 text-xs font-semibold">{a.active ? "Deactivate" : "Activate"}</button>
            </form>
            <form action={deleteAnnouncement}>
              <input type="hidden" name="id" value={a.id} />
              <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
