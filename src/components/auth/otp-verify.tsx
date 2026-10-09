"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useNow } from "@/lib/use-now";
import { Notice } from "./auth-shell";

/** Codes stop working after 10 minutes (must match Supabase's Email OTP expiry). */
export const OTP_TTL_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 60;
function fmt(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  email: string;
  /** When the current code was sent (ms). */
  sentAt: number;
  onVerified: () => void;
  onChangeEmail?: () => void;
}

export function OtpVerify({ email, sentAt: initialSentAt, onVerified, onChangeEmail }: Props) {
  const now = useNow();
  const [sentAt, setSentAt] = useState(initialSentAt);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const elapsed = now == null ? 0 : (now - sentAt) / 1000;
  const remaining = OTP_TTL_SECONDS - elapsed;
  const expired = now != null && remaining <= 0;
  const resendIn = RESEND_COOLDOWN_SECONDS - elapsed;

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase || busy) return;
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return setError("Enter the full code from the email.");
    if (expired) return setError("This code has expired. Send a new one.");
    setBusy(true);
    setError(null);
    setInfo(null);
    let { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      // Older projects issue signup codes under the "signup" type.
      const retry = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      error = retry.error ? error : null;
    }
    setBusy(false);
    if (error) {
      // Supabase uses one message for wrong and expired codes.
      setError(
        /expired|invalid|not found|token/i.test(error.message)
          ? "That code is wrong or has expired. Check the email, or send a new code."
          : error.message,
      );
      return;
    }
    onVerified();
  }

  async function resend() {
    const supabase = getSupabaseBrowser();
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) {
      setError(/rate|seconds|too many/i.test(error.message) ? "Please wait a minute before asking for another code." : error.message);
      return;
    }
    setSentAt(Date.now());
    setCode("");
    setInfo("A new code is on its way.");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      {error && <Notice kind="error">{error}</Notice>}
      {info && !error && <Notice kind="ok">{info}</Notice>}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-fg/90">Verification code</span>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 10);
            setCode(v);
            setError(null);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="••••••"
          disabled={expired}
          aria-describedby="otp-timer"
          className="h-14 w-full rounded-lg border border-line bg-bg px-3 text-center font-mono text-2xl tracking-[0.5em] outline-none transition-colors placeholder:text-dim focus:border-accent disabled:opacity-50"
        />
      </label>
      <p id="otp-timer" className={`text-center text-sm ${expired ? "text-danger" : "text-muted"}`} aria-live="polite">
        {now == null ? " " : expired ? "Code expired" : <>Code expires in <span className="font-semibold tabular-nums text-fg">{fmt(remaining)}</span></>}
      </p>
      <button
        type="submit"
        disabled={busy || expired || code.length < 6}
        className="h-11 w-full rounded-lg bg-accent font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {busy ? "Checking…" : "Verify"}
      </button>
      <div className="flex items-center justify-between text-sm">
        {onChangeEmail ? (
          <button type="button" onClick={onChangeEmail} className="text-muted hover:text-fg">
            Use a different email
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={resend}
          disabled={busy || (now != null && resendIn > 0 && !expired)}
          className="font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:text-dim disabled:no-underline"
        >
          {now != null && resendIn > 0 && !expired ? `Resend in ${fmt(resendIn)}` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
