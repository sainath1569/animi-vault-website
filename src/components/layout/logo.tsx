import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex shrink-0 items-center gap-1.5 ${className}`} aria-label="AniBeast home">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff4766" />
            <stop offset="1" stopColor="#b3123a" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill="url(#lg)" />
        <path d="M12 9.5v13l11-6.5z" fill="#fff" />
      </svg>
      <span className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">
        Ani<span className="text-accent">Beast</span>
      </span>
    </Link>
  );
}
