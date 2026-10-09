"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, Notice, SubmitButton } from "@/components/auth/auth-shell";
import { Divider, GoogleButton } from "@/components/auth/google-button";
import { OtpVerify } from "@/components/auth/otp-verify";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/** Only allow same-site relative redirects. */
export function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [pending, setPending] = useState<{ email: string; sentAt: number } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return setError("Accounts aren't configured on this server.");
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (/email not confirmed/i.test(error.message)) {
        // Never verified: send a fresh code and ask for it here.
        const { error: resendError } = await supabase.auth.resend({ type: "signup", email: email.trim() });
        setLoading(false);
        if (resendError && !/rate|seconds/i.test(resendError.message)) return setError(resendError.message);
        setPending({ email: email.trim(), sentAt: Date.now() });
        return;
      }
      setLoading(false);
      setError(/invalid login/i.test(error.message) ? "Wrong email or password." : error.message);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("banned, banned_reason").eq("id", data.user.id).maybeSingle();
    if (profile?.banned) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(`This account is suspended${profile.banned_reason ? `: ${profile.banned_reason}` : "."}`);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  if (pending) {
    return (
      <AuthShell
        title="Verify your email"
        subtitle={
          <>
            Your email isn&apos;t verified yet. We sent a code to <strong className="text-fg">{pending.email}</strong>.
          </>
        }
      >
        <OtpVerify
          email={pending.email}
          sentAt={pending.sentAt}
          onVerified={() => {
            router.replace(next);
            router.refresh();
          }}
          onChangeEmail={() => setPending(null)}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New here?{" "}
          <Link href={`/signup${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <Divider />
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm text-muted hover:text-fg">
            Forgot password?
          </Link>
        </div>
        <SubmitButton loading={loading}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}
