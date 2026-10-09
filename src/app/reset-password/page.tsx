"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell, Field, Notice, SubmitButton } from "@/components/auth/auth-shell";
import { useAuth } from "@/components/providers";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { supabase, user, ready } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace("/");
  }

  return (
    <AuthShell title="Choose a new password">
      {ready && !user ? (
        <Notice kind="error">This reset link has expired. Request a new one from the sign-in page.</Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <Field label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field label="Confirm password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <SubmitButton loading={loading}>Update password</SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
