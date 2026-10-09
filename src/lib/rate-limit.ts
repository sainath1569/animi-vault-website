import "server-only";
import { NextResponse, type NextRequest } from "next/server";

const buckets = new Map<string, { tokens: number; updated: number }>();

function clientIp(req: NextRequest) {
  return (
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

/**
 * Token bucket per IP and route group. Returns a 429 response when the
 * caller is over the limit, or null to continue.
 */
export function rateLimit(req: NextRequest, group: string, perMinute: number): NextResponse | null {
  const key = `${group}:${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: perMinute, updated: now };
  b.tokens = Math.min(perMinute, b.tokens + ((now - b.updated) / 60000) * perMinute);
  b.updated = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return NextResponse.json({ error: "Too many requests, slow down." }, { status: 429, headers: { "Retry-After": "10" } });
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 20000) {
    for (const [k, v] of buckets) if (now - v.updated > 5 * 60000) buckets.delete(k);
  }
  return null;
}
