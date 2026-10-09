"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { SearchBox } from "./search-box";
import { UserMenu } from "./user-menu";
import { Logo } from "./logo";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/seasonal", label: "Seasonal" },
  { href: "/top", label: "Top" },
  { href: "/schedule", label: "Schedule" },
  { href: "/list", label: "My List" },
];

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The watch page uses its own minimal chrome on small screens.
  const onWatch = pathname.startsWith("/watch/");

  return (
    <header
      className={cn(
        "sticky top-0 z-40 h-[var(--nav-h)] transition-colors duration-300",
        scrolled || onWatch
          ? "border-b border-white/5 bg-bg/85 backdrop-blur-xl"
          : "bg-gradient-to-b from-black/70 to-transparent",
      )}
    >
      <div className="mx-auto flex h-full max-w-[1600px] items-center gap-4 px-4 md:px-8">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "text-fg" : "text-muted hover:text-fg",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SearchBox />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
