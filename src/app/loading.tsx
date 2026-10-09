import { AnimeCardSkeleton } from "@/components/anime/anime-card";

export default function Loading() {
  return (
    <div>
      <div className="skeleton -mt-[var(--nav-h)] h-[60vh] min-h-[380px] w-full" />
      <div className="mt-10 space-y-10 px-4 md:px-8">
        {Array.from({ length: 2 }, (_, r) => (
          <div key={r}>
            <div className="skeleton mb-4 h-6 w-48 rounded" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="w-[38vw] shrink-0 sm:w-[28vw] md:w-[19vw] lg:w-[15vw] xl:w-[12.5vw] max-w-[210px]">
                  <AnimeCardSkeleton />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
