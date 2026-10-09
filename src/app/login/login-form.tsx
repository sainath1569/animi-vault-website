"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, Notice, SubmitButton } from "@/components/auth/auth-shell";
import { Divider, GoogleButton } from "@/components/auth/google-button";
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return setError("Accounts aren't configured on this server.");
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError(
        /email not confirmed/i.test(error.message)
          ? "Please confirm your email first. Check your inbox for the link."
          : /invalid login/i.test(error.message)
            ? "Wrong email or password."
            : error.message,
      );
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
