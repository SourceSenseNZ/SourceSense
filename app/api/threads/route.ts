export const runtime = "nodejs";

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const clientUserId = url.searchParams.get("userId");
    
    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("threads")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ threads: data || [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const threadId = searchParams.get("id");
    const clientUserId = searchParams.get("userId");

    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;

    if (!userId || !threadId) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Verify ownership
    const { data: thread } = await supabase
      .from("threads")
      .select("user_id")
      .eq("id", threadId)
      .single();

    if (!thread) {
      return NextResponse.json({ error: "Thread not found" }, { status: 404 });
    }

    if (thread.user_id !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await supabase.from("messages").delete().eq("thread_id", threadId);
    await supabase.from("threads").delete().eq("id", threadId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
