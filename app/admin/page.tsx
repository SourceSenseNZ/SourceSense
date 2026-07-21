"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Logo from "@/components/Logo";

type AdminUser = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  thread_count: number;
};

export default function AdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!user) {
        router.push("/login");
        return;
      }
      setAdminEmail(user.email || null);

      const res = await fetch(`/api/admin/users?requesterId=${user.id}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch users - are you admin?");
      }

      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleDeleteUser(targetId: string, targetEmail: string) {
    if (!confirm(`Delete user ${targetEmail}? This will delete ALL their threads and analyses forever. Cannot be undone.`)) return;
    if (!confirm(`FINAL CONFIRM: Delete ${targetEmail} permanently?`)) return;

    setDeletingId(targetId);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/admin/users?userId=${targetId}&requesterId=${user?.id}`, {
        method: "DELETE",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await fetchUsers();
    } catch (e: any) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)] p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-36"><Logo variant="full" /></div>
            <div>
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-xs text-[var(--app-muted)]">Manage users • {adminEmail}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/")} className="rounded-xl border border-[var(--app-border)] bg-[var(--surface-raised)] px-4 py-2 text-sm">
              ← Back to app
            </button>
            <button onClick={fetchUsers} className="rounded-xl bg-[var(--app-foreground)] px-4 py-2 text-sm font-semibold text-[var(--app-background)]">
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600">
            <p className="font-semibold">Error: {error}</p>
            <p className="mt-2 text-xs">Make sure your email is listed in ADMIN_EMAILS env (default romancrow9@gmail.com). Current admin: romancrow9@gmail.com</p>
            <p className="mt-2 text-xs">You can also delete users directly in Supabase Dashboard → Authentication → Users → Delete.</p>
          </div>
        )}

        <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6 shadow-[var(--panel-shadow)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Users ({users.length})</h2>
            <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--app-muted)]">Service role • Admin only</span>
          </div>

          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--app-muted)] animate-pulse">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--app-muted)]">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--app-border)] text-xs uppercase tracking-widest text-[var(--app-muted)]">
                    <th className="pb-3 font-semibold">Email</th>
                    <th className="pb-3 font-semibold">Created</th>
                    <th className="pb-3 font-semibold">Last sign in</th>
                    <th className="pb-3 font-semibold">Verified</th>
                    <th className="pb-3 font-semibold">Threads</th>
                    <th className="pb-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-[var(--app-border)] last:border-0 hover:bg-[var(--surface-soft)]">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{u.email}</p>
                        <p className="text-[11px] text-[var(--app-muted)] truncate max-w-[200px]">{u.id}</p>
                      </td>
                      <td className="py-3 pr-4 text-xs text-[var(--app-muted)]">
                        {new Date(u.created_at).toLocaleDateString()}<br/>
                        <span className="text-[11px]">{new Date(u.created_at).toLocaleTimeString()}</span>
                      </td>
                      <td className="py-3 pr-4 text-xs text-[var(--app-muted)]">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "Never"}
                      </td>
                      <td className="py-3 pr-4">
                        {u.email_confirmed_at ? <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs text-green-600">Yes</span> : <span className="rounded-full bg-yellow-500/10 px-2 py-1 text-xs text-yellow-600">No</span>}
                      </td>
                      <td className="py-3 pr-4">{u.thread_count}</td>
                      <td className="py-3">
                        <button
                          onClick={() => handleDeleteUser(u.id, u.email || "unknown")}
                          disabled={deletingId === u.id}
                          className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {deletingId === u.id ? "..." : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 rounded-xl border border-[var(--app-border)] bg-[var(--surface-soft)] p-4 text-xs leading-5 text-[var(--app-muted)]">
            <p className="font-semibold text-[var(--app-foreground)]">How admin delete works (simple):</p>
            <ul className="mt-2 list-disc pl-4 space-y-1">
              <li>Backend uses <code>SUPABASE_SERVICE_ROLE_KEY</code> — it bypasses security to delete anything</li>
              <li>First deletes all their threads + messages, then deletes auth user</li>
              <li>You can also do same in Supabase Dashboard → Authentication → Users → ⋯ → Delete user (easiest, no code)</li>
              <li>To add another admin: in Vercel env vars set <code>ADMIN_EMAILS=your@email.com,other@email.com</code></li>
              <li>Users can also delete themselves via "Delete account" button in sidebar</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
