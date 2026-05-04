"use client";

import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "auto";

const STORAGE_KEY = "sourcesense-theme";

const recentAnalyses = [
  "Election coverage comparison",
  "Headline framing check",
  "Source diversity review",
];

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

export default function Home() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [usageCount, setUsageCount] = useState(0);
  const MAX_FREE_USAGE = 3;
  const [loading, setLoading] = useState(false);
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

  async function handleAnalyze() {
    if (usageCount >= MAX_FREE_USAGE) {
      setResponse("Free limit reached. Please upgrade to continue.");
      return;
    }

    if (!input) return;

    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ article: input }),
      });

      const data = await res.json();
      setResponse(data.result ?? data.error ?? "Something went wrong.");

      if (res.ok) {
        setUsageCount((prev) => prev + 1);
      }
    } catch {
      setResponse("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {sidebarOpen ? (
          <aside className="hidden w-[300px] shrink-0 border-r border-[var(--app-border)] bg-[var(--sidebar-background)] px-5 py-6 md:flex md:flex-col">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-strong)] text-sm font-semibold text-white shadow-[0_18px_40px_rgba(64,172,233,0.28)]">
                SS
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                  Media Intelligence
                </p>
                <h1 className="text-xl font-semibold">SourceSense</h1>
              </div>
            </div>

            <button className="mb-8 rounded-2xl border border-[var(--app-border-strong)] bg-[var(--surface-raised)] px-4 py-3 text-left text-sm font-medium text-[var(--app-foreground)] shadow-[var(--panel-shadow)] transition hover:-translate-y-0.5 hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]">
              + New analysis
            </button>

            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-muted)]">
                Recent
              </p>
              <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs text-[var(--app-muted)]">
                {recentAnalyses.length}
              </span>
            </div>

            <div className="space-y-2">
              {recentAnalyses.map((item) => (
                <button
                  key={item}
                  className="w-full rounded-2xl border border-transparent bg-transparent px-4 py-3 text-left text-sm text-[var(--app-muted)] transition hover:border-[var(--app-border)] hover:bg-[var(--surface-soft)] hover:text-[var(--app-foreground)]"
                >
                  {item}
                </button>
              ))}
            </div>

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

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-[var(--app-border)] bg-[color:var(--topbar-background)] backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setSidebarOpen((open) => !open)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--surface-raised)] text-xl text-[var(--app-foreground)] transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              >
                ☰
              </button>

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

          <div className="flex flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
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

              <div className="mt-5 whitespace-pre-wrap text-sm leading-6 text-[var(--app-foreground)]">
                {loading && <p>Analyzing...</p>}
                {response && <p>{response}</p>}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
