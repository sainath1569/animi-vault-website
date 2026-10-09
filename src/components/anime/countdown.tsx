"use client";

import { useNow, useMounted } from "@/lib/use-now";
import { formatCountdown } from "@/lib/utils";

/** Live countdown to a unix timestamp (seconds). */
export function Countdown({ to, className }: { to: number; className?: string }) {
  const now = useNow();
  // Nothing time-dependent on the server, to avoid hydration mismatches.
  if (now == null) return <span className={className}>&nbsp;</span>;
  return <span className={className}>{formatCountdown(to - Math.floor(now / 1000))}</span>;
}

/** Local date/time for a unix timestamp, rendered client-side only. */
export function LocalTime({ ts, opts, className }: { ts: number; opts?: Intl.DateTimeFormatOptions; className?: string }) {
  const mounted = useMounted();
  const text = mounted
    ? new Date(ts * 1000).toLocaleString(undefined, opts ?? { weekday: "short", hour: "numeric", minute: "2-digit" })
    : " ";
  return <span className={className}>{text}</span>;
}
