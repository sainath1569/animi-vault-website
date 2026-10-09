import "server-only";

type Entry<T> = { value: T; fresh: number; expires: number };

const MAX_ENTRIES = 2000;
const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const stats = { hits: 0, misses: 0, stale: 0, redisHits: 0 };

// ── Optional shared layer (Upstash Redis REST) ───────────
// Survives restarts and is shared across instances. Only long-lived entries
// go here; short ones (stream URLs, overrides) stay in memory.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_MIN_TTL = 300;

async function redis(cmd: (string | number)[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(REDIS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    return ((await res.json()) as { result?: unknown }).result ?? null;
  } catch {
    return null;
  }
}

async function fromRedis<T>(key: string, ttl: number): Promise<T | undefined> {
  if (ttl < REDIS_MIN_TTL) return undefined;
  const raw = await redis(["GET", `ab:${key}`]);
  if (typeof raw !== "string") return undefined;
  try {
    const { v, t } = JSON.parse(raw) as { v: T; t: number };
    if (Date.now() - t < ttl * 1000) {
      stats.redisHits++;
      return v;
    }
  } catch {
    // Corrupt entry; refetch.
  }
  return undefined;
}

function toRedis(key: string, value: unknown, ttl: number, staleFor: number) {
  if (ttl < REDIS_MIN_TTL) return;
  void redis(["SET", `ab:${key}`, JSON.stringify({ v: value, t: Date.now() }), "EX", ttl + staleFor]);
}

function evict() {
  if (store.size <= MAX_ENTRIES) return;
  // Map keeps insertion order, so the first keys are the oldest.
  const excess = store.size - MAX_ENTRIES;
  let i = 0;
  for (const key of store.keys()) {
    if (i++ >= excess) break;
    store.delete(key);
  }
}

function load<T>(key: string, fn: () => Promise<T>, ttl: number, staleFor: number): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = (async () => {
    const shared = await fromRedis<T>(key, ttl);
    if (shared !== undefined) return shared;
    const value = await fn();
    toRedis(key, value, ttl, staleFor);
    return value;
  })()
    .then((value) => {
      store.delete(key);
      store.set(key, { value, fresh: Date.now() + ttl * 1000, expires: Date.now() + (ttl + staleFor) * 1000 });
      evict();
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/**
 * Returns a cached value, coalescing identical in-flight calls.
 * After `ttl` seconds the stale value is served while a refresh runs in the
 * background; after `ttl + staleFor` it is refetched before returning. If a
 * refetch fails and a stale value exists, the stale value is returned.
 */
export async function cached<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>,
  staleFor = ttl * 6,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.fresh > now) {
    stats.hits++;
    return hit.value;
  }
  if (hit && hit.expires > now) {
    stats.stale++;
    load(key, fn, ttl, staleFor).catch(() => {});
    return hit.value;
  }
  stats.misses++;
  try {
    return await load(key, fn, ttl, staleFor);
  } catch (err) {
    if (hit) return hit.value;
    throw err;
  }
}

export function purgeCache(prefix?: string) {
  if (!prefix) {
    const n = store.size;
    store.clear();
    return n;
  }
  let n = 0;
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      n++;
    }
  }
  return n;
}

export function cacheStats() {
  return { keys: store.size, inflight: inflight.size, ...stats };
}

/** Deletes shared (Redis) entries under a prefix. Returns how many were removed. */
export async function purgeSharedCache(prefix = ""): Promise<number> {
  let cursor = "0";
  let removed = 0;
  for (let i = 0; i < 50; i++) {
    const res = (await redis(["SCAN", cursor, "MATCH", `ab:${prefix}*`, "COUNT", 500])) as [string, string[]] | null;
    if (!res) break;
    const [next, keys] = res;
    if (keys.length) removed += Number(await redis(["DEL", ...keys])) || 0;
    cursor = next;
    if (cursor === "0") break;
  }
  return removed;
}
