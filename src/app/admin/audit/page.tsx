import { adminDb } from "@/lib/supabase/server";

export default async function AdminAudit() {
  const db = await adminDb();
  const [{ data: rows }, { data: admins }] = await Promise.all([
    db.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300),
    db.from("profiles").select("id, username").eq("role", "admin"),
  ]);
  const names = new Map((admins ?? []).map((a) => [a.id, a.username]));

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-white/5">
      <table className="w-full text-left text-sm">
        <thead className="bg-elev text-xs uppercase tracking-wider text-dim">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Admin</th>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">Target</th>
            <th className="px-3 py-2">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {(rows ?? []).map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap px-3 py-2 text-dim">{new Date(r.created_at).toLocaleString()}</td>
              <td className="px-3 py-2">{names.get(r.admin_id) ?? r.admin_id?.slice(0, 8) ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.target ?? "—"}</td>
              <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-dim">{JSON.stringify(r.meta)}</td>
            </tr>
          ))}
          {!rows?.length && (
            <tr>
              <td colSpan={5} className="px-3 py-10 text-center text-muted">
                No admin actions yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
