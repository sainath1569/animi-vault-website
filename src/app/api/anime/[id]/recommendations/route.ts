import { NextResponse, type NextRequest } from "next/server";
import { getRecommendations } from "@/lib/anilist";
import { getOverrides, withoutHidden } from "@/lib/content";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/anime/[id]/recommendations">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ items: [] }, { status: 400 });
  try {
    const [items, overrides] = await Promise.all([getRecommendations(id), getOverrides()]);
    return NextResponse.json(
      { items: withoutHidden(items, overrides) },
      { headers: { "Cache-Control": "public, max-age=600, s-maxage=3600" } },
    );
  } catch {
    return NextResponse.json({ items: [] }, { status: 503 });
  }
}
