export const SCRAPER_BASE_URL = (
  process.env.SCRAPER_BASE_URL || "https://animevault.up.railway.app"
).replace(/\/$/, "");

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/** Auth, lists and progress sync are disabled until Supabase is configured. */
export const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
