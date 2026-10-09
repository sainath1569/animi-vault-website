import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-28 text-center">
      <p className="font-[family-name:var(--font-display)] text-7xl font-extrabold text-accent">404</p>
      <h1 className="mt-4 text-xl font-semibold">This page wandered off</h1>
      <p className="mt-2 text-sm text-muted">The anime or page you’re looking for doesn’t exist or was removed.</p>
      <Link href="/" className="mt-8 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent-hover">
        Back to home
      </Link>
    </div>
  );
}
