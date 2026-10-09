// Applies supabase/migrations/*.sql in order and syncs ADMIN_EMAIL.
// Usage: npm run db:migrate   (reads DATABASE_URL and ADMIN_EMAIL from .env.local)
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const dir = join(process.cwd(), "supabase", "migrations");
for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  process.stdout.write(`Applying ${file} ... `);
  await client.query(readFileSync(join(dir, file), "utf8"));
  console.log("done");
}

const admin = process.env.ADMIN_EMAIL?.trim();
if (admin) {
  await client.query(
    `insert into private.config (key, value) values ('admin_email', $1)
     on conflict (key) do update set value = excluded.value`,
    [admin],
  );
  // Promote the account if it already exists.
  const res = await client.query(
    `update public.profiles p set role = 'admin'
     from auth.users u where u.id = p.id and lower(u.email) = lower($1) and p.role <> 'admin'`,
    [admin],
  );
  console.log(`Admin email set to ${admin}${res.rowCount ? " (existing account promoted)" : ""}`);
}

// Let PostgREST pick up the new tables immediately.
await client.query("notify pgrst, 'reload schema'");
await client.end();
console.log("Migrations complete.");
