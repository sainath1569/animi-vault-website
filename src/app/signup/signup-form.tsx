"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, Notice, SubmitButton } from "@/components/auth/auth-shell";
import { Divider, GoogleButton } from "@/components/auth/google-button";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { safeNext } from "../login/login-form";

export function SignupForm() {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

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
      window.location.href = next;
      return;
    }
    setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your email" subtitle={<>We sent a confirmation link to <strong className="text-fg">{sentTo}</strong>.</>}>
        <p className="text-center text-sm text-muted">Click the link to activate your account, then come back here.</p>
        <Link href="/login" className="mt-6 block text-center text-sm font-semibold text-accent hover:underline">
          Back to sign in
        </Link>
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
