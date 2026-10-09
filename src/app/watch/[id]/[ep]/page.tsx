import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchClient } from "@/components/player/watch-client";
import { getAnime } from "@/lib/anilist";
import { getOverrides } from "@/lib/content";
import { toInt } from "@/lib/utils";

async function load(params: PageProps<"/watch/[id]/[ep]">["params"]) {
  const { id: idParam, ep: epParam } = await params;
  const id = toInt(idParam);
  const ep = toInt(epParam);
  if (!id || id <= 0 || !ep || ep <= 0) notFound();
  const [anime, overrides] = await Promise.all([getAnime(id), getOverrides()]);
  if (!anime || overrides.hidden.has(id)) notFound();
  return { anime, ep };
}

export async function generateMetadata({ params }: PageProps<"/watch/[id]/[ep]">): Promise<Metadata> {
  const data = await load(params).catch(() => null);
  if (!data) return { title: "Watch" };
  return {
    title: `${data.anime.title} Episode ${data.ep}`,
    description: `Watch ${data.anime.title} episode ${data.ep} in sub or dub.`,
    openGraph: { images: [data.anime.banner ?? data.anime.cover] },
  };
}

export default async function WatchPage({ params }: PageProps<"/watch/[id]/[ep]">) {
  const { anime, ep } = await load(params);
  // Only card-level fields go to the client.
  const card = {
    id: anime.id,
    idMal: anime.idMal,
    title: anime.title,
    titleRomaji: anime.titleRomaji,
    cover: anime.cover,
    coverColor: anime.coverColor,
    banner: anime.banner,
    format: anime.format,
    status: anime.status,
    episodes: anime.episodes,
    score: anime.score,
    year: anime.year,
    season: anime.season,
    genres: anime.genres,
    description: null,
    nextAiring: anime.nextAiring,
    duration: anime.duration,
  };
  return <WatchClient key={`${anime.id}`} anime={card} episode={ep} />;
}
