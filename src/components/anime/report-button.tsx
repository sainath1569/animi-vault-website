"use client";

import { Flag, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "../providers";

const REASONS = [
  { value: "broken_video", label: "Video won't play" },
  { value: "wrong_episode", label: "Wrong episode" },
  { value: "subtitles", label: "Subtitle problem" },
  { value: "audio", label: "Audio problem" },
  { value: "other", label: "Something else" },
];

export function ReportButton({ anilistId, episode, compact = false }: { anilistId: number; episode?: number; compact?: boolean }) {
  const { user, supabase, enabled } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("broken_video");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (!enabled) return null;

  async function submit() {
    if (!supabase || !user) return;
    setState("sending");
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      anilist_id: anilistId,
      episode: episode ?? null,
      reason,
      details: details.trim() || null,
    });
    setState(error ? "error" : "sent");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setState("idle");
        }}
        aria-label="Report a problem"
        title="Report a problem"
        className={
          compact
            ? "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted hover:bg-white/10 hover:text-fg"
            : "flex size-12 items-center justify-center rounded-full bg-white/12 backdrop-blur transition-colors hover:bg-white/20"
        }
      >
        <Flag className={compact ? "size-3.5" : "size-5"} />
        {compact && "Report"}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Report a problem"
            className="fade-in w-full max-w-md rounded-2xl border border-line bg-elev p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Report a problem{episode ? ` · EP ${episode}` : ""}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted hover:text-fg">
                <X className="size-5" />
              </button>
            </div>
            {!user ? (
              <p className="mt-4 text-sm text-muted">
                <Link href="/login" className="font-semibold text-accent hover:underline">
                  Sign in
                </Link>{" "}
                to send a report.
              </p>
            ) : state === "sent" ? (
              <p className="mt-4 text-sm text-ok">Thanks! The team will take a look.</p>
            ) : (
              <>
                <div className="mt-4 grid gap-2">
                  {REASONS.map((r) => (
                    <label key={r.value} className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-sm has-[:checked]:border-accent">
                      <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[var(--accent)]" />
                      {r.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Details (optional)"
                  className="mt-3 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
                {state === "error" && <p className="mt-2 text-sm text-danger">Couldn&apos;t send the report. Try again.</p>}
                <button
                  type="button"
                  onClick={submit}
                  disabled={state === "sending"}
                  className="mt-4 w-full rounded-full bg-accent py-2.5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
                >
                  {state === "sending" ? "Sending…" : "Send report"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
