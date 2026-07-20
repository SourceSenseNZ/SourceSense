import { createClient } from "@supabase/supabase-js";

/**
 * Backend Supabase client - MUST use SERVICE ROLE KEY
 * This bypasses RLS and is only for API routes (server side).
 * 
 * Correct usage per architecture doc:
 * createClient(
 *   process.env.SUPABASE_URL!,
 *   process.env.SUPABASE_SERVICE_ROLE_KEY!
 * )
 * 
 * We support both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL for flexibility.
 */
export function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Helper to get user from Authorization header bearer token using service role client.
 * Returns userId if valid, null otherwise.
 */
export async function getUserFromRequest(req: Request): Promise<string | null> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    
    const token = authHeader.replace("Bearer ", "");
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}
