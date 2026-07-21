export const runtime = "nodejs";

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

// List of admin emails - set ADMIN_EMAILS and NEXT_PUBLIC_ADMIN_EMAILS in Vercel to add company email
// Example: ADMIN_EMAILS=romancrow9@gmail.com,company@sourcesense.co.nz,info@sourcesense.co.nz
const DEFAULT_ADMINS = ["romancrow9@gmail.com", "roman@romancrow.com", "info@sourcesense.co.nz", "admin@sourcesense.co.nz", "contact@sourcesense.co.nz", "hello@sourcesense.co.nz", "team@sourcesense.co.nz"];
const ENV_ADMINS = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_EMAILS = [...new Set([...DEFAULT_ADMINS, ...ENV_ADMINS, "romancrow9@gmail.com"])];

function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function GET(req: Request) {
  try {
    let requesterId = await getUserFromRequest(req);
    const url = new URL(req.url);
    const clientUserId = url.searchParams.get("requesterId");
    if (!requesterId && clientUserId) requesterId = clientUserId;

    const supabase = supabaseAdmin();

    // Get requester email to check admin
    let requesterEmail: string | null = null;
    if (requesterId) {
      const { data } = await supabase.auth.admin.getUserById(requesterId);
      requesterEmail = data.user?.email || null;
    } else {
      // Try get from Authorization header user fetch already done by getUserFromRequest returns id, we need email via service role lookup already attempted
      // If no id, check query param email (fallback for testing)
      const emailParam = url.searchParams.get("adminEmail");
      if (emailParam && isAdmin(emailParam)) {
        requesterEmail = emailParam;
      }
    }

    if (!isAdmin(requesterEmail)) {
      return NextResponse.json({ error: "Forbidden - admin only. Your email: " + (requesterEmail || "unknown") }, { status: 403 });
    }

    // List users - paginated, supabase admin listUsers
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 100,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For each user, get thread count
    const usersWithCounts = await Promise.all(
      (data.users || []).map(async (u) => {
        const { count } = await supabase.from("threads").select("id", { count: "exact", head: true }).eq("user_id", u.id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          thread_count: count || 0,
        };
      })
    );

    return NextResponse.json({ users: usersWithCounts, isAdmin: true });
  } catch (err: unknown) {
    console.error("Admin list error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const targetUserId = url.searchParams.get("userId");
    let requesterId = await getUserFromRequest(req);
    const clientRequesterId = url.searchParams.get("requesterId");
    if (!requesterId && clientRequesterId) requesterId = clientRequesterId;

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing userId to delete" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    // Verify requester is admin
    let requesterEmail: string | null = null;
    if (requesterId) {
      const { data } = await supabase.auth.admin.getUserById(requesterId);
      requesterEmail = data.user?.email || null;
    }
    const emailParam = url.searchParams.get("adminEmail");
    if (!requesterEmail && emailParam && isAdmin(emailParam)) {
      requesterEmail = emailParam;
    }

    if (!isAdmin(requesterEmail)) {
      return NextResponse.json({ error: "Forbidden - admin only" }, { status: 403 });
    }

    // Prevent self-delete via admin route (use account delete route instead)
    if (requesterId === targetUserId) {
      return NextResponse.json({ error: "Use Delete My Account button to delete yourself. Admin route blocks self-delete." }, { status: 400 });
    }

    // Delete user's threads/messages first
    const { data: threads } = await supabase.from("threads").select("id").eq("user_id", targetUserId);
    const threadIds = threads?.map((t: any) => t.id) || [];
    if (threadIds.length > 0) {
      await supabase.from("messages").delete().in("thread_id", threadIds);
    }
    await supabase.from("threads").delete().eq("user_id", targetUserId);

    // Delete auth user
    const { error } = await supabase.auth.admin.deleteUser(targetUserId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("Admin delete error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
