import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="mt-16 hidden border-t border-white/5 lg:block">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-6 px-8 py-10 text-sm text-dim">
        <div className="space-y-2">
          <Logo />
          <p className="max-w-md">
            AniBeast does not host any files. Metadata from AniList, MyAnimeList and TMDB.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Footer">
          <Link href="/browse" className="hover:text-fg">Browse</Link>
          <Link href="/seasonal" className="hover:text-fg">Seasonal</Link>
          <Link href="/top" className="hover:text-fg">Top Anime</Link>
          <Link href="/schedule" className="hover:text-fg">Schedule</Link>
          <Link href="/settings" className="hover:text-fg">Settings</Link>
        </nav>
      </div>
    </footer>
  );
}
