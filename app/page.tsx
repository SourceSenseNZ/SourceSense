"use client";

import Logo from "@/components/Logo";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type ThemeMode = "light" | "dark" | "auto";

const STORAGE_KEY = "sourcesense-theme";

type Thread = {
  id: string;
  created_at: string;
  title?: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant" | string;
  content: string;
};

const featureCards = [
  {
    title: "Bias Signals",
    description: "Flag emotionally loaded wording and one-sided framing patterns.",
  },
  {
    title: "Source Balance",
    description: "Spot whether reporting relies on a narrow set of perspectives.",
  },
  {
    title: "Tone Summary",
    description: "Turn long-form articles into a quick, readable editorial snapshot.",
  },
];

const iconButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "#aaa",
  fontSize: "14px",
};

export default function Home() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "auto";
    }

    const storedTheme = window.localStorage.getItem(STORAGE_KEY);

    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "auto") {
      return storedTheme;
    }

    return "auto";
  });

  const fetchThreads = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("threads")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setThreads(data);
    }
  }, []);

  const fetchMessages = useCallback(async (threadId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push("/login");
      }
    };

    checkSession();
  }, [router]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchThreads();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
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
    window.localStorage.setItem(STORAGE_KEY, theme);

    return () => {
      mediaQuery.removeEventListener("change", applyTheme);
    };
  }, [theme]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  function handleNewAnalysis() {
    setActiveThreadId(null);
    setMessages([]);
    setInput("");
  }

  async function handleAnalyze() {
    if (!input || loading) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        article: input,
        userId: user.id,
      }),
    });

    const data = await res.json();

    console.log("API response:", JSON.stringify(data, null, 2));
    setLoading(false);

    if (data.threadId) {
      setActiveThreadId(data.threadId);
      await fetchThreads();
      await fetchMessages(data.threadId);
    }
  }

  return (
    <main className="h-screen bg-[var(--app-background)] text-[var(--app-foreground)]">
      <div style={{ display: "flex", height: "100vh" }}>
        {sidebarOpen ? (
          <aside
            className="hidden shrink-0 bg-[var(--sidebar-background)] px-5 py-6 md:flex md:flex-col"
            style={{
              width: "260px",
              height: "100vh",
              overflowY: "auto",
              borderRight: "1px solid #2f3037",
            }}
          >
            <div className="mb-8">
              <Logo variant="full" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                Media Intelligence
              </p>
            </div>

            <button
              type="button"
              onClick={handleNewAnalysis}
              className="mb-8 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--surface-raised)] px-4 py-3 text-left text-sm font-medium text-[var(--app-foreground)] shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
              aria-current={activeThreadId === null ? "page" : undefined}
            >
              + New analysis
            </button>

            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                Recent
              </p>
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--app-muted)]">
                {threads.length}
              </span>
            </div>

            {threads.length === 0 ? (
              <p style={{ color: "#aaa", padding: "10px" }}>
                No analyses yet
              </p>
            ) : (
              threads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  activeThreadId={activeThreadId}
                  setActiveThreadId={setActiveThreadId}
                  fetchMessages={fetchMessages}
                  fetchThreads={fetchThreads}
                  setMessages={setMessages}
                />
              ))
            )}

            <div className="mt-auto rounded-3xl border border-[var(--app-border)] bg-[var(--surface-soft)] p-4">
              <p className="mb-2 text-sm font-semibold text-[var(--app-foreground)]">
                Cleaner article reviews
              </p>
              <p className="text-sm leading-6 text-[var(--app-muted)]">
                Paste any story and get a sharper read on bias, tone, and source balance.
              </p>
            </div>
          </aside>
        ) : null}

        <section
          className="flex min-w-0 flex-col"
          style={{
            flex: 1,
            height: "100vh",
            overflowY: "auto",
            padding: "20px",
          }}
        >
          <header className="shrink-0 border-b border-[var(--app-border)] bg-[color:var(--topbar-background)] backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--surface-raised)] text-xl text-[var(--app-foreground)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                ☰
              </button>

              <div
                className={
                  sidebarOpen
                    ? "w-36 shrink-0 md:hidden"
                    : "w-36 shrink-0 sm:w-44"
                }
              >
                <Logo variant="full" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                  Live workspace
                </p>
                <p className="truncate text-sm text-[var(--app-muted)]">
                  Analyze framing, tone, and source balance
                </p>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <label className="sr-only" htmlFor="theme-select">
                  Theme
                </label>
                <select
                  id="theme-select"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value as ThemeMode)}
                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-medium text-[var(--app-foreground)] outline-none transition hover:border-[var(--accent-strong)] focus:border-[var(--accent-strong)]"
                >
                  <option value="auto">Auto</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
          </header>

          <div className="flex-1">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
              <div className="rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6 shadow-[var(--panel-shadow)] sm:p-8">
                <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <span className="mb-4 inline-flex rounded-full border border-[var(--accent-border)] bg-[var(--accent-soft)] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                      Smarter article analysis
                    </span>
                    <h2 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-[var(--app-foreground)] sm:text-5xl">
                      Understand how a story is framed before you trust it.
                    </h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--app-muted)] sm:text-lg">
                      SourceSense helps you surface bias signals, sourcing gaps, and tone shifts in the articles you read every day.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {featureCards.map((card) => (
                    <article
                      key={card.title}
                      className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-5"
                    >
                      <h3 className="text-base font-semibold text-[var(--app-foreground)]">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
                        {card.description}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <aside className="rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6 shadow-[var(--panel-shadow)]">
                <div className="rounded-[28px] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
                    Workspace status
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[var(--app-foreground)]">
                    Ready to analyze
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[var(--app-muted)]">
                    Paste in a news article to review loaded wording, missing perspectives, and overall framing.
                  </p>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-4">
                    <p className="text-sm font-medium text-[var(--app-foreground)]">
                      Framing review
                    </p>
                    <p className="mt-1 text-sm text-[var(--app-muted)]">
                      Examine whether the article pushes a narrative through emphasis, omission, or wording.
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-4">
                    <p className="text-sm font-medium text-[var(--app-foreground)]">
                      Source balance
                    </p>
                    <p className="mt-1 text-sm text-[var(--app-muted)]">
                      Check whether the reporting relies on a broad mix of voices or a narrow viewpoint.
                    </p>
                  </div>
                </div>
              </aside>
            </div>

              <div className="mt-6 rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-4 shadow-[var(--panel-shadow)] sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                  Analysis result
                </p>
                <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--app-foreground)]">
                  <div
                    ref={chatContainerRef}
                    style={{
                      padding: "30px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "20px",
                    }}
                  >
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          alignSelf:
                            msg.role === "user" ? "flex-end" : "flex-start",
                          maxWidth: "75%",
                          padding: "14px 18px",
                          borderRadius: "14px",
                          backgroundColor:
                            msg.role === "user"
                              ? "#40ace9"
                              : "#2f3037",
                          color:
                            msg.role === "user"
                              ? "white"
                              : "#e5e5e5",
                          whiteSpace: "pre-wrap",
                          lineHeight: "1.5",
                        }}
                      >
                        {msg.content}
                      </motion.div>
                    ))}
                    {loading && (
                      <div
                        style={{
                          alignSelf: "flex-start",
                          backgroundColor: "#2f3037",
                          padding: "14px 18px",
                          borderRadius: "14px",
                          color: "#aaa",
                          fontStyle: "italic",
                          animation: "pulse 1.2s infinite",
                        }}
                      >
                        Analyzing...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            <div className="mt-6 rounded-[32px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-4 shadow-[var(--panel-shadow)] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                    Article input
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--app-foreground)]">
                    Paste an article to analyze
                  </h3>
                </div>
                <span className="rounded-full border border-[var(--app-border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs text-[var(--app-muted)]">
                  Bias analysis workspace
                </span>
              </div>

              <label className="sr-only" htmlFor="article-input">
                News article content
              </label>
              <textarea
                id="article-input"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Paste your news article here..."
                className="min-h-[220px] w-full rounded-[28px] border border-[var(--app-border)] bg-[var(--input-background)] px-5 py-4 text-base leading-7 text-[var(--app-foreground)] outline-none transition placeholder:text-[var(--app-muted)] focus:border-[var(--accent-strong)]"
              />

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--app-muted)]">
                  Review tone, framing, and source diversity from one place.
                </p>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  className="rounded-2xl bg-[var(--accent-strong)] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(64,172,233,0.28)] transition hover:-translate-y-0.5 hover:brightness-105"
                >
                  Analyze article
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <style jsx>{`
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </main>
  );
}

type ThreadItemProps = {
  thread: Thread;
  activeThreadId: string | null;
  setActiveThreadId: Dispatch<SetStateAction<string | null>>;
  fetchMessages: (threadId: string) => Promise<void>;
  fetchThreads: () => Promise<void>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
};

function ThreadItem({
  thread,
  activeThreadId,
  setActiveThreadId,
  fetchMessages,
  fetchThreads,
  setMessages,
}: ThreadItemProps) {
  const [editing, setEditing] = useState(false);
  const threadTitle = thread.title || "";
  const [lastThreadTitle, setLastThreadTitle] = useState(threadTitle);
  const [title, setTitle] = useState(threadTitle);

  if (threadTitle !== lastThreadTitle) {
    setLastThreadTitle(threadTitle);
    setTitle(threadTitle);
  }

  async function saveRename() {
    if (!title.trim()) {
      setEditing(false);
      return;
    }

    await supabase
      .from("threads")
      .update({ title })
      .eq("id", thread.id);

    await fetchThreads();
    setEditing(false);
  }

  async function deleteThread() {
    await supabase
      .from("messages")
      .delete()
      .eq("thread_id", thread.id);

    await supabase
      .from("threads")
      .delete()
      .eq("id", thread.id);

    if (activeThreadId === thread.id) {
      setMessages([]);
      setActiveThreadId(null);
    }

    fetchThreads();
  }

  return (
    <div
      style={{
        padding: "10px",
        borderRadius: "8px",
        marginBottom: "6px",
        backgroundColor:
          activeThreadId === thread.id
            ? "#2f3037"
            : "transparent",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      {editing ? (
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              saveRename();
            }
          }}
          onBlur={saveRename}
          autoFocus
          style={{
            backgroundColor: "#2f3037",
            border: "1px solid #40ace9",
            color: "white",
            borderRadius: "6px",
            padding: "4px 8px",
            flex: 1,
          }}
        />
      ) : (
        <span
          onClick={() => {
            setActiveThreadId(thread.id);
            fetchMessages(thread.id);
          }}
          style={{ flex: 1, cursor: "pointer" }}
        >
          {thread.title || "Untitled"}
        </span>
      )}

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => {
            setTitle(threadTitle);
            setEditing(true);
          }}
          style={iconButtonStyle}
        >
          ✏️
        </button>

        <button
          onClick={deleteThread}
          style={iconButtonStyle}
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
