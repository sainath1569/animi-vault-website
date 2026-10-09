import { purge } from "./actions";
import { cacheStats } from "@/lib/cache";
import { getHealth } from "@/lib/scraper";
import { adminDb } from "@/lib/supabase/server";

interface HealthCheck {
  ok: boolean;
  label: string;
  detail: string;
  badges?: { label: string; value: string }[];
}

export default async function AdminOverview() {
  const db = await adminDb();
  const [{ health, latency }, users, openReports, lists] = await Promise.all([
    timedHealth(),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("list_entries").select("id", { count: "exact", head: true }),
  ]);
  const checks = (health.checks ?? {}) as Record<string, HealthCheck>;
  const cache = cacheStats();

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card label="Users" value={users.count ?? 0} />
        <Card label="Open reports" value={openReports.count ?? 0} warn={(openReports.count ?? 0) > 0} />
        <Card label="List entries" value={lists.count ?? 0} />
        <Card label="Cache keys" value={cache.keys} />
      </div>

      <section>
        <h2 className="mb-3 font-semibold">
          Scraper health{" "}
          <span className={health.status === "ok" ? "text-ok" : "text-danger"}>● {String(health.status ?? "unknown")}</span>
          <span className="ml-2 text-xs font-normal text-dim">{latency} ms</span>
        </h2>
        {"error" in health && <p className="text-sm text-danger">{String(health.error)}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(checks).map(([key, c]) => (
            <div key={key} className="rounded-xl bg-elev p-4 ring-1 ring-white/5">
              <p className="font-medium">
                <span className={c.ok ? "text-ok" : "text-danger"}>●</span> {c.label}
              </p>
              <p className="mt-1 text-sm text-muted">{c.detail}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {c.badges?.map((b) => (
                  <span key={b.label} className="rounded bg-elev-2 px-2 py-0.5 text-xs">
                    {b.label}: {b.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">App cache</h2>
        <p className="text-sm text-muted">
          {cache.keys} keys · {cache.hits} hits · {cache.misses} misses · {cache.stale} stale serves · {cache.inflight} in flight
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            ["", "Purge everything"],
            ["al:", "AniList"],
            ["scr:", "Scraper"],
            ["db:", "Overrides & announcements"],
          ].map(([prefix, label]) => (
            <form key={label} action={purge}>
              <input type="hidden" name="prefix" value={prefix} />
              <button className="rounded-lg bg-elev-2 px-3 py-2 text-sm font-medium hover:bg-white/15">{label}</button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}

async function timedHealth() {
  const started = performance.now();
  const health = await getHealth().catch((e: Error) => ({ status: "down", error: e.message }) as Record<string, unknown>);
  return { health, latency: Math.round(performance.now() - started) };
}

function Card({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-elev p-4 ring-1 ring-white/5">
      <p className={`font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums ${warn ? "text-warn" : ""}`}>{value}</p>
      <p className="text-xs text-dim">{label}</p>
    </div>
  );
}
