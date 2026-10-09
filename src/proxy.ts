import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Guests keep lists, history and settings in localStorage, so only these need an account.
const PROTECTED = ["/profile"];

/**
 * Refreshes the Supabase session cookie on every page request and sends
 * signed-out visitors away from account pages. This is only an optimistic
 * check: pages and RLS still enforce access themselves.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!data.user && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(login);
  }
  // Everyone but admins gets a plain 404 for the admin panel, so its existence
  // isn't revealed. Pages check again server-side.
  if (path === "/admin" || path.startsWith("/admin/")) {
    const { data: profile } = data.user
      ? await supabase.from("profiles").select("role, banned").eq("id", data.user.id).maybeSingle()
      : { data: null };
    if (profile?.role !== "admin" || profile.banned) {
      return NextResponse.rewrite(new URL("/__not-found", request.url), { status: 404 });
    }
  }
  return response;
}

export const config = {
  matcher: [
    // Pages only: skip API routes, Next internals and static files.
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|pwa-icon/|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
