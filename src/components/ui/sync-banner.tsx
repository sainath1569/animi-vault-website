"use client";

import { Cloud } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../providers";

/** Tells guests their data lives only in this browser. */
export function SyncBanner() {
  const { user, ready, enabled } = useAuth();
  if (!ready || user || !enabled) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-elev px-4 py-3 text-sm ring-1 ring-white/5">
      <Cloud className="size-5 text-accent" />
      <p className="flex-1 text-muted">Saved on this device only. Sign in to sync across devices.</p>
      <Link href="/login" className="rounded-full bg-accent px-4 py-1.5 font-semibold text-white hover:bg-accent-hover">
        Sign in
      </Link>
    </div>
  );
}
