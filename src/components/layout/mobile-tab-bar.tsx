"use client";

import { CalendarClock, Home, ListVideo, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/browse", label: "Search", icon: Search },
  { href: "/schedule", label: "Schedule", icon: CalendarClock },
  { href: "/list", label: "My List", icon: ListVideo },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileTabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/watch/")) return null;
  return (
    <nav
      aria-label="Tabs"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/5 bg-bg/90 backdrop-blur-xl lg:hidden"
    >
      <ul className="grid h-[var(--tab-h)] grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href) || (href === "/browse" && pathname.startsWith("/search"));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-fg" : "text-dim",
                )}
              >
                <Icon className={cn("size-5", active && "text-accent")} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
