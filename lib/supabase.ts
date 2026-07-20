import { createClient } from "@supabase/supabase-js";

// Frontend client - uses anon key, respects RLS
// Fallbacks allow build to succeed without env (e.g., during prerender)
// Real env must be set at runtime via Vercel / .env.local
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
