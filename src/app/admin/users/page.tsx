import { setBan, setRole } from "../actions";
import { adminDb, getViewer } from "@/lib/supabase/server";

export default async function AdminUsers({ searchParams }: PageProps<"/admin/users">) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim() ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const db = await adminDb();
  const me = await getViewer();

  let query = db
    .from("profiles")
    .select("id, username, role, banned, banned_reason, is_public, created_at")
    .order("created_at", { ascending: false })
    .range((page - 1) * 50, page * 50 - 1);
  if (q) query = query.ilike("username", `%${q.replace(/[%_]/g, "")}%`);
  const { data: profiles } = await query;

  // Emails live in auth.users; fetch the matching page of them.
  const { data: authList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emails = new Map((authList?.users ?? []).map((u) => [u.id, u.email]));

  return (
    <div className="space-y-4">
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search username" className="h-10 w-64 rounded-lg border border-line bg-elev px-3 text-sm" />
        <button className="h-10 rounded-lg bg-elev-2 px-4 text-sm font-semibold">Search</button>
      </form>
      <div className="overflow-x-auto rounded-xl ring-1 ring-white/5">
        <table className="w-full text-left text-sm">
          <thead className="bg-elev text-xs uppercase tracking-wider text-dim">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {(profiles ?? []).map((p) => (
              <tr key={p.id} className="bg-bg">
                <td className="px-3 py-2">
                  <p className="font-medium">{p.username ?? "—"}</p>
                  <p className="text-xs text-dim">{emails.get(p.id) ?? p.id}</p>
                </td>
                <td className="px-3 py-2 text-dim">{new Date(p.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">{p.role}</td>
                <td className="px-3 py-2">
                  {p.banned ? <span className="text-danger">Banned{p.banned_reason ? `: ${p.banned_reason}` : ""}</span> : <span className="text-ok">Active</span>}
                </td>
                <td className="px-3 py-2">
                  {p.id !== me?.user.id && (
                    <div className="flex flex-wrap gap-2">
                      <form action={setBan} className="flex gap-1">
                        <input type="hidden" name="userId" value={p.id} />
                        <input type="hidden" name="banned" value={String(!p.banned)} />
                        {!p.banned && <input name="reason" placeholder="Reason" className="h-8 w-28 rounded border border-line bg-elev px-2 text-xs" />}
                        <button className={`h-8 rounded px-2.5 text-xs font-semibold ${p.banned ? "bg-ok/20 text-ok" : "bg-danger/20 text-danger"}`}>
                          {p.banned ? "Unban" : "Ban"}
                        </button>
                      </form>
                      <form action={setRole}>
                        <input type="hidden" name="userId" value={p.id} />
                        <input type="hidden" name="role" value={p.role === "admin" ? "user" : "admin"} />
                        <button className="h-8 rounded bg-elev-2 px-2.5 text-xs font-semibold">{p.role === "admin" ? "Make user" : "Make admin"}</button>
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 text-sm">
        {page > 1 && <a href={`?q=${encodeURIComponent(q)}&page=${page - 1}`} className="rounded bg-elev-2 px-3 py-1.5">Previous</a>}
        {(profiles?.length ?? 0) === 50 && <a href={`?q=${encodeURIComponent(q)}&page=${page + 1}`} className="rounded bg-elev-2 px-3 py-1.5">Next</a>}
      </div>
    </div>
  );
}
