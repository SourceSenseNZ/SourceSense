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
  {
    title: "Bias Signals",
    icon: "🎯",
    description: "Flag emotionally loaded wording and one-sided framing patterns with exact quotes.",
  },
  {
    title: "Source Balance",
    icon: "⚖️",
    description: "Spot whether reporting relies on a narrow set of perspectives or broad sourcing.",
  },
  {
    title: "Structured Scoring",
    icon: "📊",
    description: "Get bias score 0-100, leaning, credibility, and detailed breakdowns.",
  },
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
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemeMode>("auto");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // New states for requested UX
  const [heroVisible, setHeroVisible] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Theme init from localStorage client-side only
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "light" || stored === "dark" || stored === "auto") {
      setTheme(stored);
    }
  }, []);

  const fetchThreads = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserEmail(user.email || null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      const res = await fetch(`/api/threads?userId=${user.id}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      
      if (res.ok) {
        const json = await res.json();
        if (json.threads) {
          setThreads(json.threads);
          return;
        }
      }
    } catch {}

    const { data, error } = await supabase
      .from("threads")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setThreads(data as Thread[]);
    }
  }, []);

  const fetchMessages = useCallback(async (threadId: string) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch(`/api/threads/${threadId}?userId=${user?.id}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (res.ok) {
        const json = await res.json();
        if (json.messages) {
          setMessages(json.messages as Message[]);
          return;
        }
      }
    } catch {}

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as Message[]);
    }
  }, []);

  async function deleteThread(threadId: string) {
    if (!confirm("Delete this analysis?")) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch(`/api/threads?id=${threadId}&userId=${user?.id}`, {
        method: "DELETE",
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) throw new Error("API delete failed");
    } catch {
      await supabase.from("messages").delete().eq("thread_id", threadId);
      await supabase.from("threads").delete().eq("id", threadId);
    }

    if (activeThreadId === threadId) {
      setMessages([]);
      setActiveThreadId(null);
    }
    fetchThreads();
  }

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) router.push("/login");
    };
    checkSession();
  }, [router]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const resolvedDark = theme === "auto" ? mediaQuery.matches : theme === "dark";
      const resolvedTheme = resolvedDark ? "dark" : "light";
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.colorScheme = resolvedTheme;
    };
    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);
    localStorage.setItem(STORAGE_KEY, theme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeThreadId]);

  // Auto-hide hero when input focused or has content
  useEffect(() => {
    if (isInputFocused || input.trim().length > 0) {
      setHeroVisible(false);
    }
  }, [isInputFocused, input]);

  function handleNewAnalysis() {
    setActiveThreadId(null);
    setMessages([]);
    setInput("");
    setChatInput("");
    setHeroVisible(true);
    setIsInputFocused(false);
  }

  function handleInputFocus() {
    setIsInputFocused(true);
    setHeroVisible(false);
  }

  function handleInputBlur() {
    setIsInputFocused(false);
    // Only show hero again if input is empty
    if (!input.trim()) {
      // small delay so it doesn't flicker when clicking analyze button
      setTimeout(() => {
        if (!input.trim() && !loading) setHeroVisible(true);
      }, 150);
    }
  }

  async function handleAnalyze() {
    if (!input.trim() || loading) return;
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    const {
      data: { session },
    } = await supabase.auth.getSession();

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          article: input.trim(),
          userId: user.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`Analysis failed: ${data.error || "Unknown error"}`);
        setLoading(false);
        return;
      }

      if (data.threadId) {
        setActiveThreadId(data.threadId);
        await fetchThreads();
        await fetchMessages(data.threadId);
        setInput("");
        setHeroVisible(false);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleChatSend() {
    if (!chatInput.trim() || !activeThreadId || chatLoading) return;
    setChatLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const optimisticUserMsg: Message = {
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
      thread_id: activeThreadId,
      role: "user",
      content: chatInput.trim(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg]);
    const msgToSend = chatInput.trim();
    setChatInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          threadId: activeThreadId,
          message: msgToSend,
          userId: user?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Chat failed");
      }

      await fetchMessages(activeThreadId);
    } catch (e: any) {
      alert(`Chat error: ${e.message}`);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
    } finally {
      setChatLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const activeThread = threads.find((t) => t.id === activeThreadId);
  const hasAnalysis = messages.some((m) => m.analysis_json);

  return (
    <main className="h-screen bg-[var(--app-background)] text-[var(--app-foreground)]">
      <div className="flex h-screen">
        {/* Sidebar - condensed */}
        {sidebarOpen && (
          <aside className="hidden w-[280px] shrink-0 flex-col bg-[var(--sidebar-background)] px-4 py-5 md:flex"
            style={{ height: "100vh", overflowY: "auto", borderRight: "1px solid var(--app-border)" }}
          >
            <div className="mb-6">
              <Logo variant="full" />
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                Understand. More.
              </p>
            </div>

            <button
              onClick={handleNewAnalysis}
              className="mb-5 group flex w-full items-center gap-2 rounded-xl border border-[var(--app-border-strong)] bg-[var(--surface-raised)] px-3 py-2.5 text-sm font-medium shadow-sm transition hover:border-[var(--accent-strong)]"
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sourcesense-accent text-white text-xs">+</span>
              New analysis
              <span className="ml-auto text-xs text-[var(--app-muted)]">⌘N</span>
            </button>

            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Recent</p>
              <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5 text-[11px] text-[var(--app-muted)]">{threads.length}</span>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto">
              {threads.length === 0 ? (
                <p className="px-2 py-3 text-xs text-[var(--app-muted)]">No analyses yet.</p>
              ) : (
                threads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      fetchMessages(thread.id);
                    }}
                    className={`group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2.5 text-sm transition ${
                      activeThreadId === thread.id
                        ? "bg-[var(--surface-raised)] border border-[var(--app-border)] shadow-sm"
                        : "hover:bg-[var(--surface-raised)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate pr-2 text-[13px]">{thread.title || "Untitled"}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThread(thread.id);
                      }}
                      className="ml-1 hidden shrink-0 rounded p-1 text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-500 group-hover:inline-flex"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Condensed info footer */}
            <div className="mt-4">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--surface-soft)] px-3 py-2.5">
                <span className="text-sm">💡</span>
                <span className="text-[11px] leading-4 text-[var(--app-muted)]">
                  Structured AI bias scan
                </span>
              </div>
              {userEmail && (
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="truncate text-[11px] text-[var(--app-muted)] max-w-[150px]">{userEmail}</span>
                  <button onClick={handleLogout} className="text-[11px] font-medium text-[var(--accent-strong)] hover:underline">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Main */}
        <section className="flex min-w-0 flex-1 flex-col" style={{ height: "100vh", overflowY: "auto" }}>
          <header className="sticky top-0 z-10 shrink-0 border-b border-[var(--app-border)] bg-[color:var(--topbar-background)] backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <button
                onClick={() => setSidebarOpen((o) => !o)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--surface-raised)]"
              >
                ☰
              </button>

              <div className={sidebarOpen ? "hidden w-32 md:hidden" : "w-32 sm:w-40"}>
                <Logo variant="full" />
              </div>

              {activeThread ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{activeThread.title}</p>
                  <p className="text-xs text-[var(--app-muted)]">{messages.length} messages</p>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">Live workspace</p>
                </div>
              )}

              <div className="ml-auto">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemeMode)}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--surface-raised)] px-3 py-1.5 text-xs font-medium outline-none"
                >
                  <option value="auto">Auto</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </header>

          <div className="flex-1 p-4 sm:p-6" ref={chatContainerRef}>
            {!activeThreadId ? (
              <>
                {/* Hero - now hides when input focused */}
                <AnimatePresence>
                  {heroVisible && (
                    <motion.div
                      initial={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6 shadow-[var(--panel-shadow)] sm:p-8 mb-6">
                        <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                          Understand how a story is framed before you trust it.
                        </h2>
                        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--app-muted)] sm:text-lg">
                          Paste any news article. SourceSense surfaces bias, framing, and loaded language in seconds.
                        </p>

                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                          {featureCards.map((card) => (
                            <article key={card.title} className="rounded-[20px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-5">
                              <div className="mb-2 text-lg">{card.icon}</div>
                              <h3 className="text-sm font-semibold">{card.title}</h3>
                              <p className="mt-1.5 text-xs leading-5 text-[var(--app-muted)]">{card.description}</p>
                            </article>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Input - clicking this hides hero */}
                <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-4 shadow-[var(--panel-shadow)] sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold">
                      {heroVisible ? "Paste an article to analyze" : "Ready to analyze"}
                    </h3>
                    {!heroVisible && (
                      <button
                        onClick={() => setHeroVisible(true)}
                        className="text-xs text-[var(--app-muted)] hover:text-[var(--accent-strong)] hover:underline"
                      >
                        Show intro ↟
                      </button>
                    )}
                  </div>
                  
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    placeholder="Paste full news article here (min 50 chars). Include headline if possible..."
                    className="min-h-[220px] w-full rounded-[20px] border border-[var(--app-border)] bg-[var(--input-background)] px-4 py-3 text-[15px] leading-7 outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--accent-soft)] transition"
                  />
                  
                  <div className="mt-3 flex items-center justify-end">
                    <button
                      onClick={handleAnalyze}
                      disabled={!input.trim() || loading}
                      className="inline-flex items-center justify-center rounded-xl bg-sourcesense-accent px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          Analyzing...
                        </>
                      ) : (
                        "Analyze article"
                      )}
                    </button>
                  </div>
                </div>

                {/* Subtle hint when hero hidden */}
                {!heroVisible && !input.trim() && (
                  <p className="mt-3 text-center text-xs text-[var(--app-muted)]">
                    Intro hidden while you type. Press the input to focus. Click "Show intro" to bring it back.
                  </p>
                )}
              </>
            ) : (
              <div className="mx-auto max-w-5xl space-y-6">
                {messages.map((msg) => {
                  if (msg.role === "user") {
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-end"
                      >
                        <div className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-[#40ace9] px-5 py-3 text-sm leading-6 text-white shadow">
                          {msg.content.length > 600 ? (
                            <details>
                              <summary className="cursor-pointer font-medium">Original article ({msg.content.length} chars) - expand</summary>
                              <p className="mt-3 whitespace-pre-wrap">{msg.content}</p>
                            </details>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  }

                  const analysis = msg.analysis_json as ArticleAnalysis | null;
                  if (analysis && analysis.biasScore !== undefined) {
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                        <AnalysisCard analysis={analysis} />
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                      <div className="max-w-[85%] rounded-[20px] rounded-bl-[6px] border border-[var(--app-border)] bg-[var(--surface-raised)] px-5 py-4 text-sm leading-6 text-[var(--app-foreground)] shadow-sm">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </motion.div>
                  );
                })}

                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-[20px] border border-[var(--app-border)] bg-[var(--surface-raised)] px-5 py-4 text-sm italic text-[var(--app-muted)] animate-pulse">
                      Analyzing...
                    </div>
                  </div>
                )}

                {hasAnalysis && (
                  <div className="sticky bottom-0 mt-8 rounded-[24px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-3 shadow-[var(--panel-shadow)] backdrop-blur">
                    <div className="flex gap-3">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleChatSend();
                          }
                        }}
                        placeholder="Follow-up question..."
                        className="flex-1 rounded-xl border border-[var(--app-border)] bg-[var(--input-background)] px-4 py-3 text-sm outline-none focus:border-[var(--accent-strong)]"
                        disabled={chatLoading}
                      />
                      <button
                        onClick={handleChatSend}
                        disabled={!chatInput.trim() || chatLoading}
                        className="rounded-xl bg-[var(--app-foreground)] px-5 py-3 text-sm font-semibold text-[var(--app-background)] disabled:opacity-50"
                      >
                        {chatLoading ? "..." : "Send"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
