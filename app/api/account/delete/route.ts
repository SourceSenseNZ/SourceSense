export const runtime = "nodejs";

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const clientUserId = url.searchParams.get("userId");
    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized - please sign in" }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    // Verify user exists
    const { data: userData, error: getError } = await supabase.auth.admin.getUserById(userId);
    if (getError || !userData.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete threads and messages first (if RLS prevents cascade, use service role which bypasses)
    await supabase.from("messages").delete().in("thread_id", 
      (await supabase.from("threads").select("id").eq("user_id", userId).then(r => r.data?.map((t:any)=>t.id) || [])) || []
    );
    await supabase.from("threads").delete().eq("user_id", userId);

    // Delete auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("Delete user error:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Account deleted" });
  } catch (err: unknown) {
    console.error("Delete account error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
