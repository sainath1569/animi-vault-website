import type { ReactNode } from "react";
import { Logo } from "../layout/logo";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(100vh-var(--nav-h))] items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(232,48,79,0.18),transparent_60%)]" />
      <div className="relative w-full max-w-sm rounded-2xl border border-line bg-elev/90 p-7 shadow-2xl shadow-black/50 backdrop-blur">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <h1 className="text-center text-xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1.5 text-center text-sm text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-fg/90">{label}</span>
      <input
        {...props}
        className="h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm outline-none transition-colors placeholder:text-dim focus:border-accent"
      />
    </label>
  );
}

export function SubmitButton({ children, loading }: { children: ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="h-11 w-full rounded-lg bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function Notice({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={
        kind === "error"
          ? "rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/30"
          : "rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok ring-1 ring-ok/30"
      }
    >
      {children}
    </p>
  );
}
