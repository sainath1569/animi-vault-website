import { AnimeGridSkeleton } from "@/components/anime/anime-grid";

export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6 md:px-8">
      <div className="skeleton h-8 w-40 rounded" />
      <div className="mt-5 flex gap-2">
        <div className="skeleton h-10 w-72 rounded-lg" />
        <div className="skeleton h-10 w-32 rounded-lg" />
      </div>
      <div className="mt-8">
        <AnimeGridSkeleton />
      </div>
    </div>
  );
}
