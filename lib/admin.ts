// Central admin config - supports both server and client
// Set in Vercel: ADMIN_EMAILS and NEXT_PUBLIC_ADMIN_EMAILS
// Example: "romancrow9@gmail.com,company@sourcesense.co.nz"

export function getAdminEmails(): string[] {
  // Server side: ADMIN_EMAILS, Client side: NEXT_PUBLIC_ADMIN_EMAILS
  const raw = (process.env.ADMIN_EMAILS || process.env.NEXT_PUBLIC_ADMIN_EMAILS || "romancrow9@gmail.com")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  
  // Always include primary admin as fallback
  if (!raw.includes("romancrow9@gmail.com")) {
    raw.push("romancrow9@gmail.com");
  }
  return raw;
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const admins = getAdminEmails();
  return admins.includes(email.toLowerCase());
}

// For client components that can't access process.env directly at runtime (Next.js needs NEXT_PUBLIC_ prefix)
export function isAdminEmailClient(email: string | undefined | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  // Check against known admins plus any NEXT_PUBLIC_ env
  const publicRaw = (typeof process !== "undefined" && (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "")) || "";
  const publicList = publicRaw.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
  
  const hardcoded = ["romancrow9@gmail.com", "roman@romancrow.com"];
  const all = [...new Set([...hardcoded, ...publicList, "romancrow9@gmail.com"])].map(e => e.toLowerCase());
  
  // Also allow if ADMIN_EMAILS env includes it (server will double-check)
  return all.includes(lower);
}
