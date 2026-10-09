/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CalendarClock, ExternalLink, Music2, Star } from "lucide-react";
import { getAnime } from "@/lib/anilist";
import { getOverrides } from "@/lib/content";
import { getAnimeArt, getEpisodeList } from "@/lib/scraper";
import type { AnimeDetail } from "@/lib/types";
import { compactNumber, formatLabel, seasonLabel, statusLabel, toInt } from "@/lib/utils";
import { DetailActions } from "@/components/anime/detail-actions";
import { EpisodeList } from "@/components/anime/episode-list";
import { Countdown } from "@/components/anime/countdown";
import { Synopsis } from "@/components/anime/synopsis";
import { Trailer } from "@/components/anime/trailer";
import { Row } from "@/components/anime/anime-row";
import { AnimeCard } from "@/components/anime/anime-card";

export const revalidate = 3600;

async function load(idParam: string) {
  const id = toInt(idParam);
  if (!id || id <= 0) notFound();
  // AniList errors propagate to error.tsx so a failed render is never cached.
  const [anime, overrides] = await Promise.all([getAnime(id), getOverrides()]);
  if (!anime || overrides.hidden.has(id)) notFound();
  return anime;
}

export async function generateMetadata({ params }: PageProps<"/anime/[id]">): Promise<Metadata> {
  const anime = await load((await params).id).catch(() => null);
  if (!anime) return { title: "Anime" };
  return {
    title: anime.title,
    description: anime.description?.slice(0, 160) ?? undefined,
    openGraph: { title: anime.title, images: [anime.banner ?? anime.cover] },
  };
}

export default async function AnimePage({ params }: PageProps<"/anime/[id]">) {
  const anime = await load((await params).id);
  const canPlay = anime.status !== "NOT_YET_RELEASED";

  return (
    <div className="pb-10">
      {/* Backdrop */}
      <div className="relative -mt-[var(--nav-h)] h-[46vh] min-h-[300px] max-h-[520px] w-full overflow-hidden">
        <Suspense fallback={<BackdropImage src={anime.banner} fallback={anime.cover} />}>
          <ArtBackdrop anime={anime} />
        </Suspense>
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-r from-bg/80 to-transparent" />
      </div>

      <div className="relative mx-auto -mt-44 max-w-[1600px] px-4 md:-mt-56 md:px-8">
        <div className="flex flex-col gap-6 md:flex-row md:gap-10">
          <img
            src={anime.cover}
            alt={anime.title}
            className="w-36 shrink-0 self-start rounded-xl shadow-2xl shadow-black/70 ring-1 ring-white/10 sm:w-44 md:w-60"
            style={{ backgroundColor: anime.coverColor ?? undefined }}
          />
          <div className="min-w-0 flex-1 md:pt-24">
            <Suspense fallback={<Title anime={anime} />}>
              <ArtTitle anime={anime} />
            </Suspense>
            {anime.titleRomaji !== anime.title && <p className="mt-1 text-sm text-muted">{anime.titleRomaji}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {anime.score ? (
                <span className="flex items-center gap-1 font-semibold">
                  <Star className="size-4 fill-warn text-warn" /> {(anime.score / 10).toFixed(1)}
                </span>
              ) : null}
              {[
                formatLabel(anime.format),
                anime.season && anime.year ? `${seasonLabel(anime.season)} ${anime.year}` : anime.year,
                anime.episodes ? `${anime.episodes} episodes` : null,
                anime.duration ? `${anime.duration} min` : null,
                statusLabel(anime.status),
              ]
                .filter(Boolean)
                .map((x) => (
                  <span key={String(x)} className="text-fg/80">
                    {x}
                  </span>
                ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {anime.genres.map((g) => (
                <Link
                  key={g}
                  href={`/browse?genre=${encodeURIComponent(g)}`}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-fg"
                >
                  {g}
                </Link>
              ))}
            </div>

            {anime.nextAiring && (
              <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent/15 px-3 py-2 text-sm text-fg ring-1 ring-accent/30">
                <CalendarClock className="size-4 text-accent" />
                Episode {anime.nextAiring.episode} airs in{" "}
                <Countdown to={anime.nextAiring.airingAt} className="font-semibold tabular-nums" />
              </p>
            )}

            <div className="mt-6">
              <DetailActions anime={anime} canPlay={canPlay} />
            </div>

            {anime.description && (
              <div className="mt-6 max-w-3xl">
                <Synopsis text={anime.description} />
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 grid gap-12 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-12">
            {canPlay && (
              <section id="episodes">
                <SectionTitle>Episodes</SectionTitle>
                <Suspense fallback={<EpisodesSkeleton />}>
                  <Episodes anime={anime} />
                </Suspense>
              </section>
            )}

            {anime.characters.length > 0 && (
              <section>
                <SectionTitle>Characters & Voice Actors</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {anime.characters.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 overflow-hidden rounded-lg bg-elev ring-1 ring-white/5">
                      <div className="flex min-w-0 items-center gap-3">
                        {c.image && <img src={c.image} alt="" loading="lazy" className="h-20 w-14 shrink-0 object-cover" />}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="text-xs capitalize text-dim">{c.role.toLowerCase()}</p>
                        </div>
                      </div>
                      {c.voiceActor && (
                        <div className="flex min-w-0 items-center gap-3 text-right">
                          <div className="min-w-0">
                            <p className="truncate text-sm">{c.voiceActor.name}</p>
                            <p className="text-xs text-dim">{c.voiceActor.language}</p>
                          </div>
                          {c.voiceActor.image && (
                            <img src={c.voiceActor.image} alt="" loading="lazy" className="h-20 w-14 shrink-0 object-cover" />
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {anime.trailer?.site === "youtube" && (
              <section>
                <SectionTitle>Trailer</SectionTitle>
                <Trailer youtubeId={anime.trailer.id} title={anime.title} />
              </section>
            )}

            <Suspense fallback={null}>
              <Themes anime={anime} />
            </Suspense>
          </div>

          <aside className="space-y-8">
            <InfoPanel anime={anime} />
          </aside>
        </div>
      </div>

      <div className="mt-12 space-y-10">
        {anime.relations.length > 0 && (
          <Row title="Related">
            {anime.relations.map((r) => (
              <AnimeCard
                key={r.anime.id}
                anime={r.anime}
                subtitle={`${r.relationType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} · ${formatLabel(r.anime.format) ?? ""}`}
              />
            ))}
          </Row>
        )}
        {anime.recommendations.length > 0 && (
          <Row title="You might also like">
            {anime.recommendations.map((a) => (
              <AnimeCard key={a.id} anime={a} />
            ))}
          </Row>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-[family-name:var(--font-display)] text-xl font-bold tracking-tight">{children}</h2>;
}

function Title({ anime, logo }: { anime: AnimeDetail; logo?: string | null }) {
  if (logo) {
    return (
      <h1>
        <img src={logo} alt={anime.title} className="max-h-28 max-w-[min(100%,420px)] object-contain object-left drop-shadow-xl md:max-h-36" />
      </h1>
    );
  }
  return (
    <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
      {anime.title}
    </h1>
  );
}

async function ArtTitle({ anime }: { anime: AnimeDetail }) {
  const art = anime.idMal ? await getAnimeArt(anime.idMal).catch(() => null) : null;
  return <Title anime={anime} logo={art?.logo} />;
}

function BackdropImage({ src, fallback }: { src: string | null; fallback: string }) {
  return (
    <img
      src={src ?? fallback}
      alt=""
      className={src ? "size-full object-cover" : "size-full scale-110 object-cover blur-2xl"}
      fetchPriority="high"
    />
  );
}

async function ArtBackdrop({ anime }: { anime: AnimeDetail }) {
  const art = anime.idMal ? await getAnimeArt(anime.idMal).catch(() => null) : null;
  return <BackdropImage src={art?.cover ?? anime.banner} fallback={anime.cover} />;
}

async function Episodes({ anime }: { anime: AnimeDetail }) {
  const { episodes } = await getEpisodeList(anime.id, anime.idMal, anime.nextAiring ? anime.nextAiring.episode - 1 : anime.episodes).catch(
    () => ({ episodes: [], streamable: false }),
  );
  return <EpisodeList animeId={anime.id} episodes={episodes} fallbackThumb={anime.banner ?? anime.cover} />;
}

function EpisodesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i}>
          <div className="skeleton aspect-video rounded-lg" />
          <div className="skeleton mt-2 h-4 w-3/4 rounded" />
        </div>
      ))}
    </div>
  );
}

async function Themes({ anime }: { anime: AnimeDetail }) {
  const art = anime.idMal ? await getAnimeArt(anime.idMal).catch(() => null) : null;
  const themes = art?.themes;
  if (!themes || (!themes.opening.length && !themes.ending.length)) return null;
  return (
    <section>
      <SectionTitle>Theme Songs</SectionTitle>
      <div className="grid gap-6 md:grid-cols-2">
        {(["opening", "ending"] as const).map((kind) =>
          themes[kind].length ? (
            <div key={kind}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-dim">{kind === "opening" ? "Openings" : "Endings"}</h3>
              <ul className="space-y-2">
                {themes[kind].map((t) => (
                  <li key={`${kind}-${t.number}-${t.title}`} className="flex items-start gap-3 rounded-lg bg-elev px-3 py-2.5 text-sm ring-1 ring-white/5">
                    <Music2 className="mt-0.5 size-4 shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-dim">
                        {[t.artist, t.episodes ? `eps ${t.episodes}` : null].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {t.spotifyUrl && (
                      <a href={t.spotifyUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold text-ok hover:underline">
                        Spotify
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}
      </div>
    </section>
  );
}

function InfoPanel({ anime }: { anime: AnimeDetail }) {
  const rank = anime.rankings.find((r) => r.type === "RATED" && r.allTime);
  const pop = anime.rankings.find((r) => r.type === "POPULAR" && r.allTime);
  const rows: [string, React.ReactNode][] = [
    ["Format", formatLabel(anime.format)],
    ["Episodes", anime.episodes],
    ["Duration", anime.duration ? `${anime.duration} min` : null],
    ["Status", statusLabel(anime.status)],
    ["Aired", anime.startDate ? `${anime.startDate}${anime.endDate ? ` → ${anime.endDate}` : ""}` : null],
    ["Season", anime.season && anime.year ? `${seasonLabel(anime.season)} ${anime.year}` : null],
    ["Studios", anime.studios.join(", ") || null],
    ["Source", anime.source ? anime.source.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : null],
    ["Popularity", compactNumber(anime.popularity)],
    ["Favorites", compactNumber(anime.favourites)],
    ["Ranked", rank ? `#${rank.rank} all time` : null],
    ["Most popular", pop ? `#${pop.rank} all time` : null],
    ["English", anime.titleEnglish],
    ["Native", anime.titleNative],
  ];
  const streaming = anime.externalLinks.filter((l) => l.type === "STREAMING");
  return (
    <>
      <dl className="rounded-xl bg-elev p-5 text-sm ring-1 ring-white/5">
        {rows
          .filter(([, v]) => v != null && v !== "")
          .map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line/60 py-2 last:border-0">
              <dt className="shrink-0 text-dim">{k}</dt>
              <dd className="text-right text-fg/90">{v}</dd>
            </div>
          ))}
      </dl>
      {anime.tags.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-dim">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {anime.tags.map((t) => (
              <span key={t} className="rounded-md bg-elev px-2 py-1 text-xs text-muted ring-1 ring-white/5">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
      {streaming.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-dim">Official Streaming</h3>
          <ul className="space-y-1.5">
            {streaming.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-elev px-3 py-2 text-sm ring-1 ring-white/5 hover:ring-accent/50"
                >
                  {l.icon && <img src={l.icon} alt="" className="size-4" style={{ backgroundColor: l.color ?? undefined }} />}
                  <span className="flex-1">{l.site}</span>
                  <ExternalLink className="size-3.5 text-dim" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
