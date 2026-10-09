"use server";

import { revalidatePath } from "next/cache";
import { purgeCache, purgeSharedCache } from "@/lib/cache";
import { getSupabaseAdmin, getViewer } from "@/lib/supabase/server";

/** Verifies the caller is an admin and returns a service-role client. */
async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer || viewer.profile.role !== "admin" || viewer.profile.banned) throw new Error("Forbidden");
  const db = getSupabaseAdmin();
  if (!db) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return { db, adminId: viewer.user.id };
}

async function audit(adminId: string, action: string, target: string | null, meta: Record<string, unknown> = {}) {
  const db = getSupabaseAdmin();
  await db?.from("admin_audit_log").insert({ admin_id: adminId, action, target, meta });
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const n = parseInt(str(f, k), 10);
  return Number.isFinite(n) ? n : null;
};

// ── Users ────────────────────────────────────────────────

export async function setBan(form: FormData) {
  const { db, adminId } = await requireAdmin();
  const userId = str(form, "userId");
  const banned = str(form, "banned") === "true";
  const reason = str(form, "reason").slice(0, 200) || null;
  if (userId === adminId) throw new Error("You can't ban yourself");
  await db.from("profiles").update({ banned, banned_reason: banned ? reason : null }).eq("id", userId);
  // Also block sign-in at the auth layer.
  await db.auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
  await audit(adminId, banned ? "user.ban" : "user.unban", userId, { reason });
  revalidatePath("/admin/users");
}

export async function setRole(form: FormData) {
  const { db, adminId } = await requireAdmin();
  const userId = str(form, "userId");
  const role = str(form, "role") === "admin" ? "admin" : "user";
  if (userId === adminId && role !== "admin") throw new Error("You can't demote yourself");
  await db.from("profiles").update({ role }).eq("id", userId);
  await audit(adminId, "user.role", userId, { role });
  revalidatePath("/admin/users");
}

// ── Reports ──────────────────────────────────────────────

export async function setReportStatus(form: FormData) {
  const { db, adminId } = await requireAdmin();
  const id = int(form, "id");
  const status = str(form, "status");
  if (!id || !["open", "resolved", "dismissed"].includes(status)) return;
  await db.from("reports").update({ status }).eq("id", id);
  await audit(adminId, `report.${status}`, String(id));
  revalidatePath("/admin/reports");
}

// ── Content overrides ────────────────────────────────────

export async function saveOverride(form: FormData) {
  const { db, adminId } = await requireAdmin();
  const anilistId = int(form, "anilistId");
  if (!anilistId || anilistId <= 0) throw new Error("AniList ID is required");
  let customIds: Record<string, unknown> = {};
  const raw = str(form, "customIds");
  if (raw) {
    try {
      customIds = JSON.parse(raw);
    } catch {
      throw new Error("Custom IDs must be valid JSON");
    }
  }
  const row = {
    anilist_id: anilistId,
    title: str(form, "title") || null,
    hidden: form.get("hidden") === "on",
    featured: form.get("featured") === "on",
    featured_order: int(form, "featuredOrder") ?? 0,
    custom_ids: customIds,
  };
  await db.from("anime_overrides").upsert(row);
  await audit(adminId, "override.save", String(anilistId), row);
  purgeCache("db:overrides");
  revalidatePath("/admin/content");
}

export async function deleteOverride(form: FormData) {
  const { db, adminId } = await requireAdmin();
  const anilistId = int(form, "anilistId");
  if (!anilistId) return;
  await db.from("anime_overrides").delete().eq("anilist_id", anilistId);
  await audit(adminId, "override.delete", String(anilistId));
  purgeCache("db:overrides");
  revalidatePath("/admin/content");
}

// ── Announcements ────────────────────────────────────────

export async function createAnnouncement(form: FormData) {
  const { db, adminId } = await requireAdmin();
  const message = str(form, "message").slice(0, 300);
  const link = str(form, "link") || null;
  if (!message) throw new Error("Message is required");
  if (link && !/^https?:\/\//.test(link)) throw new Error("Link must start with http(s)://");
  await db.from("announcements").insert({ message, link, active: true });
  await audit(adminId, "announcement.create", null, { message });
  purgeCache("db:announcements");
  revalidatePath("/admin/announcements");
}

export async function toggleAnnouncement(form: FormData) {
  const { db, adminId } = await requireAdmin();
  const id = int(form, "id");
  const active = str(form, "active") === "true";
  if (!id) return;
  await db.from("announcements").update({ active }).eq("id", id);
  await audit(adminId, active ? "announcement.activate" : "announcement.deactivate", String(id));
  purgeCache("db:announcements");
  revalidatePath("/admin/announcements");
}

export async function deleteAnnouncement(form: FormData) {
  const { db, adminId } = await requireAdmin();
  const id = int(form, "id");
  if (!id) return;
  await db.from("announcements").delete().eq("id", id);
  await audit(adminId, "announcement.delete", String(id));
  purgeCache("db:announcements");
  revalidatePath("/admin/announcements");
}

// ── Ops ──────────────────────────────────────────────────

export async function purge(form: FormData) {
  const { adminId } = await requireAdmin();
  const prefix = str(form, "prefix") || undefined;
  const n = purgeCache(prefix);
  const shared = await purgeSharedCache(prefix ?? "");
  await audit(adminId, "cache.purge", prefix ?? "all", { keys: n, sharedKeys: shared });
  revalidatePath("/admin");
}
