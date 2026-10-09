import { NextResponse } from "next/server";
import { getSupabaseAdmin, getSupabaseServer } from "@/lib/supabase/server";

/** Permanently deletes the signed-in user. Rows cascade from auth.users. */
export async function DELETE() {
  const supabase = await getSupabaseServer();
  const admin = getSupabaseAdmin();
  if (!supabase || !admin) return NextResponse.json({ error: "Accounts aren't configured." }, { status: 503 });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { error } = await admin.auth.admin.deleteUser(data.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
