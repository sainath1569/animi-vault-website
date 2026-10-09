import { NextResponse, type NextRequest } from "next/server";
import { browse } from "@/lib/anilist";
import { getOverrides, withoutHidden } from "@/lib/content";
import { rateLimit } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, "search", 60);
  if (limited) return limited;
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(30, Math.max(1, Number(req.nextUrl.searchParams.get("limit")) || 10));
  if (q.length < 2) return NextResponse.json({ items: [] });
  try {
    const [{ items }, overrides] = await Promise.all([browse({ search: q.slice(0, 80), perPage: limit }), getOverrides()]);
    return NextResponse.json(
      { items: withoutHidden(items, overrides) },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
    );
  } catch {
    return NextResponse.json({ items: [], error: "Search is unavailable right now." }, { status: 503 });
  }
}
