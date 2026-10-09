"use client";

/* eslint-disable @next/next/no-img-element */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, X } from "lucide-react";
import Link from "next/link";
import { Row } from "../anime/anime-row";
import { AnimeCard } from "../anime/anime-card";
import { useTrackCtx } from "../providers";
import { useContinueWatching, useList } from "@/lib/hooks";
import { removeFromContinue, type ContinueItem } from "@/lib/tracking";
import type { AnimeCard as Card } from "@/lib/types";

export function PersonalRows({ position }: { position: "top" | "middle" }) {
  if (position === "top") return <ContinueWatchingRow />;
  return (
    <>
      <BecauseYouWatched />
      <PlanToWatchRow />
    </>
  );
}

function ContinueWatchingRow() {
  const { data } = useContinueWatching();
  const ctx = useTrackCtx();
  const qc = useQueryClient();
  if (!data?.length) return null;

  async function remove(id: number) {
    await removeFromContinue(ctx, id);
    void qc.invalidateQueries({ queryKey: ["continue"] });
  }

  return (
    <Row title="Continue Watching" itemClassName="w-[70vw] sm:w-[45vw] md:w-[32vw] lg:w-[24vw] xl:w-[20vw] max-w-[340px]">
      {data.map((item) => (
        <ContinueCard key={item.anilist_id} item={item} onRemove={() => remove(item.anilist_id)} />
      ))}
    </Row>
  );
}

function ContinueCard({ item, onRemove }: { item: ContinueItem; onRemove: () => void }) {
  return (
    <div className="group relative">
      <Link href={`/watch/${item.anilist_id}/${item.resumeEpisode}`} className="block">
        <div className="relative aspect-video overflow-hidden rounded-lg bg-elev ring-1 ring-white/5 transition group-hover:ring-accent/60">
          {item.poster && (
            <img
              src={item.poster}
              alt=""
              className="size-full object-cover object-[50%_25%] transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent">
              <Play className="ml-0.5 size-5 fill-white text-white" />
            </span>
          </span>
          <div className="absolute inset-x-0 bottom-0 p-3">
            <p className="truncate text-sm font-semibold">{item.title}</p>
            <p className="text-xs text-fg/70">
              {item.percent > 0 ? `Episode ${item.resumeEpisode}` : `Up next: Episode ${item.resumeEpisode}`}
            </p>
          </div>
          {item.percent > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
              <div className="h-full bg-accent" style={{ width: `${item.percent}%` }} />
            </div>
          )}
        </div>
      </Link>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.title} from Continue Watching`}
        className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 opacity-0 transition-opacity hover:bg-black group-hover:opacity-100 focus:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function BecauseYouWatched() {
  const { data: cw } = useContinueWatching();
  const seed = cw?.[0];
  const { data } = useQuery({
    queryKey: ["recs", seed?.anilist_id],
    queryFn: async () => {
      const res = await fetch(`/api/anime/${seed!.anilist_id}/recommendations`);
      if (!res.ok) return [];
      return ((await res.json()) as { items: Card[] }).items;
    },
    enabled: Boolean(seed),
    staleTime: 30 * 60_000,
  });
  if (!seed || !data?.length) return null;
  return (
    <Row title={`Because you watched ${seed.title ?? "this"}`}>
      {data.map((a) => (
        <AnimeCard key={a.id} anime={a} />
      ))}
    </Row>
  );
}

function PlanToWatchRow() {
  const { data } = useList();
  const plan = (data ?? []).filter((e) => e.status === "plan");
  if (!plan.length) return null;
  return (
    <Row title="Plan to Watch" href="/list?status=plan">
      {plan.map((e) => (
        <AnimeCard
          key={e.anilist_id}
          anime={{
            id: e.anilist_id,
            idMal: e.mal_id,
            title: e.title,
            titleRomaji: e.title,
            cover: e.poster ?? "",
            coverColor: null,
            banner: null,
            format: (e.format as Card["format"]) ?? null,
            status: null,
            episodes: e.episodes_total,
            score: null,
            year: null,
            season: null,
            genres: e.genres,
            description: null,
            nextAiring: null,
            duration: null,
          }}
        />
      ))}
    </Row>
  );
}
