import { NextResponse, type NextRequest } from "next/server";
import { getEpisodeList } from "@/lib/scraper";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/episodes/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const malId = Number(req.nextUrl.searchParams.get("malId")) || null;
  const count = Number(req.nextUrl.searchParams.get("count")) || null;
  try {
    const data = await getEpisodeList(id, malId, count);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=300, s-maxage=1800" } });
  } catch {
    return NextResponse.json({ episodes: [], streamable: false }, { status: 503 });
  }
}
