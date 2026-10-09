"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, Notice, SubmitButton } from "@/components/auth/auth-shell";
import { Divider, GoogleButton } from "@/components/auth/google-button";
import { OtpVerify } from "@/components/auth/otp-verify";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "../login/login-form";

export function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ email: string; sentAt: number } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return setError("Accounts aren't configured on this server.");
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
      return setError("Username must be 3–24 letters, numbers or underscores.");
    }
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) return setError(error.message);
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) {
      return setError("An account with this email already exists. Try signing in.");
    }
    if (data.session) {
      // Email confirmation is turned off in Supabase: already signed in.
      router.replace(next);
      router.refresh();
      return;
    }
    setPending({ email: email.trim(), sentAt: Date.now() });
  }

  if (pending) {
    return (
      <AuthShell
        title="Verify your email"
        subtitle={
          <>
            We sent a code to <strong className="text-fg">{pending.email}</strong>. It works for 10 minutes.
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
      title="Create your account"
      subtitle={
        <>
          Already have one?{" "}
          <Link href="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton next={next} />
      <Divider />
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <Notice kind="error">{error}</Notice>}
        <Field label="Username" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} maxLength={24} />
        <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <SubmitButton loading={loading}>Create account</SubmitButton>
        <p className="text-center text-xs text-dim">Your lists are private by default.</p>
      </form>
    </AuthShell>
  );
}
