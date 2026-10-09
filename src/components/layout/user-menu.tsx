"use client";

import { History, LogOut, Settings, Shield, User as UserIcon, ListVideo } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../providers";
import { Avatar } from "../ui/avatar";

export function UserMenu() {
  const { user, profile, ready, enabled, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!ready) return <div className="skeleton size-9 rounded-full" />;
  if (!enabled) return null;
  if (!user) {
    return (
      <Link
        href="/login"
        className="hidden rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover sm:block"
      >
        Sign in
      </Link>
    );
  }

  const name = profile?.username ?? user.email?.split("@")[0] ?? "You";
  const items = [
    { href: "/profile", label: "Profile", icon: UserIcon },
    { href: "/list", label: "My List", icon: ListVideo },
    { href: "/history", label: "History", icon: History },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="rounded-full ring-offset-2 ring-offset-bg transition hover:ring-2 hover:ring-line"
      >
        <Avatar src={profile?.avatar_url} name={name} size={36} />
      </button>
      {open && (
        <div className="fade-in absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-elev py-1 shadow-2xl shadow-black/60">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-dim">{user.email}</p>
          </div>
          {items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted hover:bg-elev-2 hover:text-fg"
            >
              <Icon className="size-4" /> {label}
            </Link>
          ))}
          {profile?.role === "admin" && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-warn hover:bg-elev-2"
            >
              <Shield className="size-4" /> Admin
            </Link>
          )}
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 border-t border-line px-4 py-2.5 text-sm text-muted hover:bg-elev-2 hover:text-fg"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
