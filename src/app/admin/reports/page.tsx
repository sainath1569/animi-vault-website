import Link from "next/link";
import { setReportStatus } from "../actions";
import { adminDb } from "@/lib/supabase/server";

const STATUSES = ["open", "resolved", "dismissed"];

export default async function AdminReports({ searchParams }: PageProps<"/admin/reports">) {
  const sp = await searchParams;
  const status = STATUSES.includes(String(sp.status)) ? String(sp.status) : "open";
  const db = await adminDb();
  const { data: reports } = await db
    .from("reports")
    .select("id, reporter_id, anilist_id, episode, reason, details, status, created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4">
      <nav className="flex gap-1">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/reports?status=${s}`}
            className={`rounded-full px-4 py-1.5 text-sm capitalize ${s === status ? "bg-accent text-white" : "bg-elev text-muted"}`}
          >
            {s}
          </Link>
        ))}
      </nav>
      {!reports?.length && <p className="py-10 text-center text-muted">No {status} reports.</p>}
      <ul className="space-y-2">
        {(reports ?? []).map((r) => (
          <li key={r.id} className="flex flex-wrap items-start gap-4 rounded-xl bg-elev p-4 ring-1 ring-white/5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <Link href={r.episode ? `/watch/${r.anilist_id}/${r.episode}` : `/anime/${r.anilist_id}`} className="text-accent hover:underline" target="_blank">
                  AniList {r.anilist_id}
                  {r.episode ? ` · EP ${r.episode}` : ""}
                </Link>{" "}
                <span className="ml-2 rounded bg-elev-2 px-2 py-0.5 text-xs">{r.reason.replace("_", " ")}</span>
              </p>
              {r.details && <p className="mt-1 text-sm text-muted">{r.details}</p>}
              <p className="mt-1 text-xs text-dim">{new Date(r.created_at).toLocaleString()}</p>
            </div>
            <div className="flex gap-2">
              {STATUSES.filter((s) => s !== r.status).map((s) => (
                <form key={s} action={setReportStatus}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="status" value={s} />
                  <button className="rounded-lg bg-elev-2 px-3 py-1.5 text-xs font-semibold capitalize hover:bg-white/15">
                    {s === "open" ? "Reopen" : s === "resolved" ? "Resolve" : "Dismiss"}
                  </button>
                </form>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
