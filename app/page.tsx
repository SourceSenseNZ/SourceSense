"use client";
import Logo from "@/components/Logo";
import AnalysisCard from "@/components/AnalysisCard";
import { supabase } from "@/lib/supabase";
import type { ArticleAnalysis, Message, Thread } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";
const STORAGE_KEY = "sourcesense-theme";
const featureCards = [
  { title: "Bias Signals", icon: "🎯", description: "Flag loaded wording with exact quotes." },
  { title: "Source Balance", icon: "⚖️", description: "Check if reporting uses narrow perspectives." },
  { title: "Structured Scoring", icon: "📊", description: "Bias 0-100, leaning, credibility." },
];

export default function Home() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<ArticleAnalysis | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemeMode>("auto");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [heroVisible, setHeroVisible] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored) setTheme(stored);
  }, []);

  const fetchThreads = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserEmail(user.email || null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/threads?userId=${user.id}`, { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
      if (res.ok) {
        const json = await res.json();
        if (json.threads) { setThreads(json.threads); return; }
      }
    } catch {}
    const { data } = await supabase.from("threads").select("*").order("created_at", { ascending: false });
    if (data) setThreads(data as Thread[]);
  }, []);

  const fetchMessages = useCallback(async (threadId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch(`/api/threads/${threadId}?userId=${user?.id}`, { headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
      if (res.ok) {
        const json = await res.json();
        if (json.messages) { setMessages(json.messages as Message[]); const last = [...json.messages].reverse().find((m:any)=>m.analysis_json); if (last) setLastAnalysis(last.analysis_json); return; }
      }
    } catch {}
    const { data } = await supabase.from("messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true });
    if (data) { setMessages(data as Message[]); const last = [...data].reverse().find((m:any)=>m.analysis_json); if (last) setLastAnalysis(last.analysis_json as any); }
  }, []);

  async function deleteThread(threadId: string) {
    if (!confirm("Delete?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    try {
      await fetch(`/api/threads?id=${threadId}&userId=${user?.id}`, { method: "DELETE", headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
    } catch {
      await supabase.from("messages").delete().eq("thread_id", threadId);
      await supabase.from("threads").delete().eq("id", threadId);
    }
    if (activeThreadId === threadId) { setMessages([]); setActiveThreadId(null); setLastAnalysis(null); }
    fetchThreads();
  }

  useEffect(() => { supabase.auth.getSession().then(({data})=>{ if (!data.session) router.push("/login"); }); }, [router]);
  useEffect(() => { fetchThreads(); }, [fetchThreads]);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const dark = theme === "auto" ? mq.matches : theme === "dark"; document.documentElement.dataset.theme = dark ? "dark" : "light"; };
    apply(); mq.addEventListener("change", apply); localStorage.setItem(STORAGE_KEY, theme); return () => mq.removeEventListener("change", apply);
  }, [theme]);

  function handleNewAnalysis() { setActiveThreadId(null); setMessages([]); setLastAnalysis(null); setInput(""); setHeroVisible(true); }
  function handleInputFocus() { setIsInputFocused(true); setHeroVisible(false); }
  function handleInputBlur() { setIsInputFocused(false); if (!input.trim() && !loading) setTimeout(()=>{ if (!input.trim()) setHeroVisible(true); },150); }

  async function handleAnalyze() {
    if (!input.trim() || loading) return;
    setLoading(true); setLastAnalysis(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const controller = new AbortController();
    const tid = setTimeout(()=>controller.abort(), 15000);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ article: input.trim(), userId: user.id }),
        signal: controller.signal,
      });
      clearTimeout(tid);
      const data = await res.json();
      if (!res.ok) { alert(`Analysis failed: ${data.error || "Unknown"}`); setLoading(false); return; }
      if (data.analysis) {
        setLastAnalysis(data.analysis as ArticleAnalysis);
        setActiveThreadId(data.threadId);
        setMessages([
          { id: "u", created_at: new Date().toISOString(), thread_id: data.threadId, role: "user", content: input.trim() } as any,
          { id: "a", created_at: new Date().toISOString(), thread_id: data.threadId, role: "assistant", content: data.analysis.summary, analysis_json: data.analysis } as any,
        ]);
        await fetchThreads();
        setInput("");
        setHeroVisible(false);
      }
    } catch (e: any) {
      clearTimeout(tid);
      alert(e.name === "AbortError" ? "Timed out after 15s - try shorter article" : `Error: ${e.message}`);
    } finally { setLoading(false); }
  }

  async function handleChatSend() {
    if (!chatInput.trim() || !activeThreadId || chatLoading) return;
    setChatLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    const optimistic: Message = { id: `temp-${Date.now()}`, created_at: new Date().toISOString(), thread_id: activeThreadId, role: "user", content: chatInput.trim() } as any;
    setMessages(p=>[...p, optimistic]);
    const msg = chatInput.trim(); setChatInput("");
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json", ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, body: JSON.stringify({ threadId: activeThreadId, message: msg, userId: user?.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchMessages(activeThreadId);
    } catch (e: any) { alert(`Chat error: ${e.message}`); setMessages(p=>p.filter(m=>m.id!==optimistic.id)); } finally { setChatLoading(false); }
  }

  async function handleLogout() { await supabase.auth.signOut(); router.push("/login"); }
  async function handleDeleteAccount() {
    if (!confirm("DELETE ACCOUNT? All data gone forever?")) return;
    if (!confirm("FINAL CHECK: Really delete?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    if (!user) return;
    try {
      const res = await fetch(`/api/account/delete?userId=${user.id}`, { method: "DELETE", headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {} });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await supabase.auth.signOut(); router.push("/login");
    } catch (e: any) { alert(`Delete failed: ${e.message}`); }
  }

  const activeThread = threads.find(t=>t.id===activeThreadId);
  const isAdmin = (()=>{ if (!userEmail) return false; const env = (process.env.NEXT_PUBLIC_ADMIN_EMAILS||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean); const hard=["romancrow9@gmail.com","info@sourcesense.co.nz","admin@sourcesense.co.nz"]; return [...new Set([...hard,...env])].includes(userEmail.toLowerCase()); })();

  return (
    <main className="h-screen bg-[var(--app-background)] text-[var(--app-foreground)]">
      <div className="flex h-screen">
        {sidebarOpen && (
          <aside className="hidden w-[280px] shrink-0 flex-col bg-[var(--sidebar-background)] px-4 py-5 md:flex" style={{ height: "100vh", overflowY: "auto", borderRight: "1px solid var(--app-border)" }}>
            <div className="mb-6"><Logo variant="full" /><p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">Understand. More.</p></div>
            <button onClick={handleNewAnalysis} className="mb-5 flex w-full items-center gap-2 rounded-xl border border-[var(--app-border-strong)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm font-medium">+ New analysis <span className="ml-auto text-xs text-[var(--app-muted)]">⌘N</span></button>
            <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Recent</p><span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] text-[var(--app-muted)]">{threads.length}</span></div>
            <div className="flex-1 space-y-1 overflow-y-auto">
              {threads.length===0 ? <p className="px-2 py-3 text-xs text-[var(--app-muted)]">No analyses yet.</p> : threads.map(thread=>(
                <div key={thread.id} onClick={()=>{ setActiveThreadId(thread.id); fetchMessages(thread.id); }} className={`group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2.5 text-sm ${activeThreadId===thread.id ? "bg-[var(--surface-raised)] border border-[var(--app-border)]" : "hover:bg-[var(--surface-raised)]"}`}>
                  <span className="min-w-0 flex-1 truncate pr-2 text-[13px]">{thread.title || "Untitled"}</span>
                  <button onClick={e=>{ e.stopPropagation(); deleteThread(thread.id); }} className="ml-1 hidden group-hover:inline-flex rounded p-1 text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-500">🗑️</button>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--surface-soft)] px-3 py-2.5"><span className="text-sm">💡</span><span className="text-[11px] text-[var(--app-muted)]">Real AI bias scan</span></div>
              {userEmail && (
                <div className="rounded-xl border border-[var(--app-border)] bg-[var(--surface-raised)] px-3 py-2">
                  <p className="truncate text-[11px] font-medium max-w-[200px]">{userEmail}</p>
                  <div className="mt-2 flex gap-3"><button onClick={handleLogout} className="text-[11px] text-[var(--accent-strong)] hover:underline">Sign out</button><span className="text-[var(--app-border)]">•</span><button onClick={handleDeleteAccount} className="text-[11px] text-red-500 hover:underline">Delete</button></div>
                  {isAdmin && <button onClick={()=>router.push("/admin")} className="mt-2 w-full rounded-lg bg-[var(--app-foreground)] py-1.5 text-[11px] font-semibold text-[var(--app-background)]">Admin → Manage users</button>}
                </div>
              )}
            </div>
          </aside>
        )}
        <section className="flex min-w-0 flex-1 flex-col" style={{ height: "100vh", overflowY: "auto" }}>
          <header className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[color:var(--topbar-background)] backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <button onClick={()=>setSidebarOpen(o=>!o)} className="h-9 w-9 rounded-xl border border-[var(--app-border)] bg-[var(--surface-raised)]">☰</button>
              <div className={sidebarOpen ? "hidden w-32 md:hidden" : "w-32 sm:w-40"}><Logo variant="full" /></div>
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">{activeThread ? activeThread.title : "Live workspace"}</p></div>
              <div className="ml-auto"><select value={theme} onChange={e=>setTheme(e.target.value as any)} className="rounded-xl border border-[var(--app-border)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs"><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
            </div>
          </header>
          <div className="flex-1 p-4 sm:p-6" ref={chatContainerRef}>
            {!activeThreadId && !lastAnalysis ? (
              <>
                <AnimatePresence>
                  {heroVisible && (
                    <motion.div initial={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35 }} className="overflow-hidden">
                      <div className="rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6 sm:p-8 mb-6 shadow-[var(--panel-shadow)]">
                        <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Understand how a story is framed before you trust it.</h2>
                        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--app-muted)]">Paste any news article. SourceSense surfaces bias, framing, and loaded language in seconds.</p>
                        <div className="mt-8 grid gap-4 md:grid-cols-3">{featureCards.map(card=>(
                          <article key={card.title} className="rounded-[20px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-5"><div className="mb-2 text-lg">{card.icon}</div><h3 className="text-sm font-semibold">{card.title}</h3><p className="mt-1.5 text-xs text-[var(--app-muted)]">{card.description}</p></article>
                        ))}</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-4 sm:p-5 shadow-[var(--panel-shadow)]">
                  <div className="mb-3 flex justify-between"><h3 className="text-base font-semibold">{heroVisible ? "Paste an article to analyze" : "Ready to analyze"}</h3>{!heroVisible && <button onClick={()=>setHeroVisible(true)} className="text-xs text-[var(--app-muted)] hover:underline">Show intro ↟</button>}</div>
                  <textarea value={input} onChange={e=>setInput(e.target.value)} onFocus={handleInputFocus} onBlur={handleInputBlur} placeholder="Paste full news article here..." className="min-h-[220px] w-full rounded-[20px] border border-[var(--app-border)] bg-[var(--input-background)] px-4 py-3 text-[15px] outline-none focus:border-[var(--accent-strong)]" />
                  <div className="mt-3 flex justify-end"><button onClick={handleAnalyze} disabled={!input.trim() || loading} className="rounded-xl bg-sourcesense-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg disabled:opacity-50">{loading ? "Analyzing..." : "Analyze article"}</button></div>
                </div>
              </>
            ) : (
              <div className="mx-auto max-w-5xl space-y-6">
                {lastAnalysis && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><AnalysisCard analysis={lastAnalysis} /></motion.div>
                )}
                {messages.map(msg=>{
                  if (msg.role==="user") return <div key={msg.id} className="flex justify-end"><div className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-[#40ace9] px-5 py-3 text-sm text-white">{msg.content.length>600 ? <details><summary>Original article ({msg.content.length} chars)</summary><p className="mt-3 whitespace-pre-wrap">{msg.content}</p></details> : <p className="whitespace-pre-wrap">{msg.content}</p>}</div></div>;
                  const analysis = (msg as any).analysis_json as ArticleAnalysis | null;
                  if (analysis && analysis.biasScore!==undefined && msg.id!=="a") return <motion.div key={msg.id} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}><AnalysisCard analysis={analysis} /></motion.div>;
                  if (msg.id==="a") return null;
                  return <div key={msg.id} className="flex justify-start"><div className="max-w-[85%] rounded-[20px] bg-[var(--surface-raised)] border border-[var(--app-border)] px-5 py-4 text-sm"><p className="whitespace-pre-wrap">{msg.content}</p></div></div>;
                })}
                {loading && <div className="flex justify-start"><div className="rounded-[20px] border bg-[var(--surface-raised)] px-5 py-4 text-sm italic animate-pulse">Analyzing with real AI...</div></div>}
                {lastAnalysis && (
                  <div className="sticky bottom-0 mt-8 rounded-[24px] border bg-[var(--surface-raised)] p-3 shadow-[var(--panel-shadow)]"><div className="flex gap-3"><input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{ if (e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleChatSend(); } }} placeholder="Follow-up question..." className="flex-1 rounded-xl border px-4 py-3 text-sm bg-[var(--input-background)]" disabled={chatLoading} /><button onClick={handleChatSend} disabled={!chatInput.trim() || chatLoading} className="rounded-xl bg-[var(--app-foreground)] px-5 py-3 text-sm font-semibold text-[var(--app-background)]">{chatLoading?"...":"Send"}</button></div></div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
