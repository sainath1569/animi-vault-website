"use client";

/* eslint-disable @next/next/no-img-element */
import { Play } from "lucide-react";
import { useState } from "react";

/** YouTube trailer that only loads the iframe after a click. */
export function Trailer({ youtubeId, title }: { youtubeId: string; title: string }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="relative aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-elev ring-1 ring-white/5">
      {play ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={`${title} trailer`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      ) : (
        <button type="button" onClick={() => setPlay(true)} className="group size-full" aria-label="Play trailer">
          <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt="" className="size-full object-cover" loading="lazy" />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/10">
            <span className="flex size-16 items-center justify-center rounded-full bg-accent shadow-xl">
              <Play className="ml-1 size-7 fill-white text-white" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
