"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthShell, Field, Notice, SubmitButton } from "@/components/auth/auth-shell";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabaseBrowser();
    if (!supabase) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to set a new one.">
      {sent ? (
        <Notice kind="ok">If an account exists for {email}, a reset link is on its way.</Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <SubmitButton loading={loading}>Send reset link</SubmitButton>
        </form>
      )}
      <Link href="/login" className="mt-6 block text-center text-sm text-muted hover:text-fg">
        Back to sign in
      </Link>
    </AuthShell>
  );
}
