import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

/** Handles OAuth codes, email confirmation and password-recovery links. */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const errorDescription = url.searchParams.get("error_description");

  const fail = (msg: string) => {
    const to = new URL("/login", url.origin);
    to.searchParams.set("error", msg);
    return NextResponse.redirect(to);
  };

  if (errorDescription) return fail(errorDescription);
  const supabase = await getSupabaseServer();
  if (!supabase) return fail("Accounts aren't configured on this server.");

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("That sign-in link is invalid or has expired. Please try again.");
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("That link is invalid or has expired. Please request a new one.");
    if (type === "recovery") return NextResponse.redirect(new URL("/reset-password", url.origin));
  } else {
    return fail("Missing sign-in code.");
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
