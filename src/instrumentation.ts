/**
 * Runs once when the server starts. Applies ADMIN_EMAIL so the env variable
 * alone decides who the admin is: the account is promoted if it exists, or
 * becomes admin on signup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const email = process.env.ADMIN_EMAIL?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !url || !key) return;
  try {
    const res = await fetch(`${url}/rest/v1/rpc/sync_admin_email`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_email: email }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) console.warn(`[admin] Couldn't apply ADMIN_EMAIL (${res.status}). Run npm run db:migrate.`);
  } catch (err) {
    console.warn("[admin] Couldn't apply ADMIN_EMAIL:", (err as Error).message);
  }
}
