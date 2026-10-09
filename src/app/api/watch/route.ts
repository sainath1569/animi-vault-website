import { NextResponse, type NextRequest } from "next/server";
import { getOverrides } from "@/lib/content";
import { rateLimit } from "@/lib/rate-limit";
import { getWatch, ScraperError } from "@/lib/scraper";
import type { StreamSource, StreamType } from "@/lib/types";

const SOURCES: StreamSource[] = ["anikoto", "animeheaven", "desidub"];

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "watch", 40);
  if (limited) return limited;

  const p = req.nextUrl.searchParams;
  const id = Number(p.get("id"));
  const ep = Number(p.get("ep"));
  const type: StreamType = p.get("type") === "dub" ? "dub" : "sub";
  const sourceParam = p.get("source") as StreamSource | null;
  const source = sourceParam && SOURCES.includes(sourceParam) ? sourceParam : undefined;
  const server = p.get("server")?.slice(0, 60) || undefined;

  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(ep) || ep <= 0) {
    return NextResponse.json({ error: "Invalid episode" }, { status: 400 });
  }
  const overrides = await getOverrides();
  if (overrides.hidden.has(id)) {
    return NextResponse.json({ error: "This title is unavailable." }, { status: 451 });
  }

  try {
    const data = await getWatch(id, ep, type, source, server);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    const status = err instanceof ScraperError && err.status >= 400 && err.status < 500 ? 404 : 502;
    const message =
      err instanceof ScraperError && status === 404
        ? err.message
        : "The streaming source didn't respond. Try another server or source.";
    return NextResponse.json({ error: message }, { status });
  }
}
