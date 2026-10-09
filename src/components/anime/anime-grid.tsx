import type { AnimeCard as Card } from "@/lib/types";
import { AnimeCard, AnimeCardSkeleton } from "./anime-card";

export function AnimeGrid({ items, ranked = false, startRank = 1 }: { items: Card[]; ranked?: boolean; startRank?: number }) {
  if (!items.length) {
    return <p className="py-16 text-center text-muted">Nothing here yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {items.map((a, i) => (
        <AnimeCard key={a.id} anime={a} rank={ranked ? startRank + i : undefined} priority={i < 6} />
      ))}
    </div>
  );
}

export function AnimeGridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
      {Array.from({ length: count }, (_, i) => (
        <AnimeCardSkeleton key={i} />
      ))}
    </div>
  );
}
