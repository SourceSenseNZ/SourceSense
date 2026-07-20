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

    // Prefer API route (uses service role, RLS-safe), fallback to direct supabase query
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

    // Fallback: direct query (requires RLS disabled or policy)
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

    // Fallback direct
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
      // Fallback direct delete
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

  function handleNewAnalysis() {
    setActiveThreadId(null);
    setMessages([]);
    setInput("");
    setChatInput("");
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

      // Re-fetch full thread to get saved messages
      await fetchMessages(activeThreadId);
    } catch (e: any) {
      alert(`Chat error: ${e.message}`);
      // Rollback optimistic
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
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="hidden w-[300px] shrink-0 flex-col bg-[var(--sidebar-background)] px-5 py-6 md:flex"
            style={{ height: "100vh", overflowY: "auto", borderRight: "1px solid var(--app-border)" }}
          >
            <div className="mb-8">
              <Logo variant="full" />
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                Media Intelligence • v2.0
              </p>
            </div>

            <button
              onClick={handleNewAnalysis}
              className="mb-6 group flex w-full items-center justify-between rounded-2xl border border-[var(--app-border-strong)] bg-[var(--surface-raised)] px-4 py-3 text-left text-sm font-medium shadow-[var(--panel-shadow)] transition hover:border-[var(--accent-strong)]"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sourcesense-accent text-white">+</span>
                New analysis
              </span>
              <span className="text-[var(--app-muted)] group-hover:text-[var(--accent-strong)]">⌘N</span>
            </button>

            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">Recent</p>
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--app-muted)]">{threads.length}</span>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto">
              {threads.length === 0 ? (
                <p className="px-2 py-4 text-sm text-[var(--app-muted)]">No analyses yet. Paste an article to start.</p>
              ) : (
                threads.map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      fetchMessages(thread.id);
                    }}
                    className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-3 text-sm transition ${
                      activeThreadId === thread.id
                        ? "bg-[var(--surface-raised)] border border-[var(--app-border)] shadow-sm"
                        : "hover:bg-[var(--surface-raised)]"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate pr-2">{thread.title || "Untitled analysis"}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThread(thread.id);
                      }}
                      className="ml-2 hidden shrink-0 rounded-lg p-1 text-[var(--app-muted)] hover:bg-red-500/10 hover:text-red-500 group-hover:inline-flex"
                      aria-label="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 space-y-3">
              <div className="rounded-3xl border border-[var(--app-border)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-semibold">How it works</p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]">
                  Structured AI scores bias 0-100, flags loaded language, detects framing, checks sourcing, and saves to Supabase.
                </p>
              </div>
              {userEmail && (
                <div className="flex items-center justify-between rounded-2xl border border-[var(--app-border)] bg-[var(--surface-raised)] px-3 py-2">
                  <span className="truncate text-xs text-[var(--app-muted)]">{userEmail}</span>
                  <button onClick={handleLogout} className="text-xs font-medium text-[var(--accent-strong)] hover:underline">
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--app-border)] bg-[var(--surface-raised)]"
                aria-label="Toggle sidebar"
              >
                ☰
              </button>

              <div className={sidebarOpen ? "hidden w-36 md:hidden" : "w-36 sm:w-44"}>
                <Logo variant="full" />
              </div>

              {activeThread ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{activeThread.title}</p>
                  <p className="text-xs text-[var(--app-muted)]">{messages.length} messages • Structured analysis</p>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">Live workspace</p>
                  <p className="truncate text-sm text-[var(--app-muted)]">Real AI analysis • JSON storage • Multi-message chat</p>
                </div>
              )}

              <div className="ml-auto flex items-center gap-2">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemeMode)}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--surface-raised)] px-3 py-2 text-xs font-medium outline-none"
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
                {/* Intro Hero */}
                <div className="grid gap-6 xl:grid-cols-[1.2fr_380px]">
                  <div className="rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6 shadow-[var(--panel-shadow)] sm:p-8">
                    <span className="mb-4 inline-flex rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                      Now with gpt-4.1-mini + structured JSON
                    </span>
                    <h2 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                      Understand how a story is framed before you trust it.
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--app-muted)] sm:text-lg">
                      SourceSense upgraded: real OpenAI Responses API, bias 0-100 scoring, loaded language detection, framing analysis, and persistent multi-turn threads.
                    </p>

                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                      {featureCards.map((card) => (
                        <article key={card.title} className="rounded-[24px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-5">
                          <div className="mb-3 text-xl">{card.icon}</div>
                          <h3 className="text-sm font-semibold">{card.title}</h3>
                          <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">{card.description}</p>
                        </article>
                      ))}
                    </div>
                  </div>

                  <aside className="rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6 shadow-[var(--panel-shadow)]">
                    <div className="rounded-[24px] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">DB Status</p>
                      <p className="mt-2 text-xl font-semibold">RLS Ready • JSON Storage</p>
                      <ul className="mt-3 list-disc pl-4 text-xs leading-5 text-[var(--app-muted)]">
                        <li>threads: id, user_id, title</li>
                        <li>messages: id, thread_id, role, content, analysis_json jsonb</li>
                        <li>Service role key in backend only</li>
                      </ul>
                    </div>
                    <div className="mt-4 rounded-[20px] bg-[var(--surface-soft)] p-4 text-xs leading-5 text-[var(--app-muted)]">
                      <p className="font-semibold text-[var(--app-foreground)]">What you get:</p>
                      • Bias score gauge<br/>• Leaning badge (Centre, Left, Right...)<br/>• Framing cards with quotes<br/>• Loaded language severity<br/>• Missing context + sources to check
                    </div>
                  </aside>
                </div>

                {/* Input */}
                <div className="mt-6 rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-4 shadow-[var(--panel-shadow)] sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-xl font-semibold tracking-[-0.02em]">Paste an article to analyze</h3>
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--surface-soft)] px-3 py-1 text-xs text-[var(--app-muted)]">gpt-4.1-mini • structured</span>
                  </div>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Paste full news article here (min 50 chars). Include headline if possible. The AI will extract framing, loaded language, missing context, etc."
                    className="min-h-[220px] w-full rounded-[24px] border border-[var(--app-border)] bg-[var(--input-background)] px-5 py-4 text-[15px] leading-7 outline-none placeholder:text-[var(--app-muted)] focus:border-[var(--accent-strong)]"
                  />
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-[var(--app-muted)]">
                      Backend uses SUPABASE_SERVICE_ROLE_KEY. Mock fallback if OPENAI_API_KEY missing.
                    </p>
                    <button
                      onClick={handleAnalyze}
                      disabled={!input.trim() || loading}
                      className="inline-flex items-center justify-center rounded-xl bg-sourcesense-accent px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50"
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
              </>
            ) : (
              <div className="mx-auto max-w-5xl space-y-6">
                {/* Messages + Analysis */}
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
                              <summary className="cursor-pointer font-medium">Original article ({msg.content.length} chars) - click to expand</summary>
                              <p className="mt-3 whitespace-pre-wrap">{msg.content}</p>
                            </details>
                          ) : (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          )}
                        </div>
                      </motion.div>
                    );
                  }

                  // Assistant
                  const analysis = msg.analysis_json as ArticleAnalysis | null;
                  if (analysis && analysis.biasScore !== undefined) {
                    return (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                        <AnalysisCard analysis={analysis} />
                      </motion.div>
                    );
                  }

                  // Regular chat reply
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
                      Running structured analysis with gpt-4.1-mini...
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
                        placeholder="Ask follow-up: e.g. 'What bias techniques are strongest?' or 'What context is missing?'"
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
                    <p className="mt-2 px-1 text-[11px] text-[var(--app-muted)]">
                      Chat uses thread history. Press Enter to send, Shift+Enter for newline.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
