"use client";

import type { ArticleAnalysis } from "@/lib/types";

type Props = {
  analysis: ArticleAnalysis;
};

const leaningColors: Record<string, string> = {
  "Far Left": "bg-[#d63b3b] text-white",
  Left: "bg-[#ef6461] text-white",
  "Centre-left": "bg-[#f4a261] text-white",
  Centre: "bg-[#40ace9] text-white",
  "Centre-right": "bg-[#e76f51] text-white",
  Right: "bg-[#e85d3f] text-white",
  "Far Right": "bg-[#c1121f] text-white",
};

function BiasGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (score / 100) * circumference;
  
  let color = "#40ace9";
  if (score <= 20) color = "#2ecc71";
  else if (score <= 40) color = "#40ace9";
  else if (score <= 60) color = "#f4a261";
  else if (score <= 80) color = "#e76f51";
  else color = "#c1121f";

  return (
    <div className="relative flex h-[116px] w-[116px] items-center justify-center">
      <svg width="116" height="116" viewBox="0 0 116 116" className="-rotate-90">
        <circle cx="58" cy="58" r="44" stroke="var(--app-border)" strokeWidth="10" fill="none" />
        <circle
          cx="58"
          cy="58"
          r="44"
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tracking-tight" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
          Bias
        </span>
      </div>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    low: "bg-[var(--surface-soft)] text-[var(--app-muted)] border-[var(--app-border)]",
    medium: "bg-[#fff3cd] text-[#856404] border-[#ffe69c] dark:bg-[#3a3000] dark:text-[#ffda6a] dark:border-[#5a4a00]",
    high: "bg-[#f8d7da] text-[#721c24] border-[#f5c6cb] dark:bg-[#3a0a0f] dark:text-[#ff8b9a] dark:border-[#5c1a22]",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${map[severity] || map.low}`}>
      {severity}
    </span>
  );
}

export default function AnalysisCard({ analysis }: Props) {
  const leaningClass = leaningColors[analysis.leaning] || leaningColors["Centre"];

  return (
    <div className="space-y-6">
      {/* Header Score Row */}
      <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6 shadow-[var(--panel-shadow)]">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-6">
            <BiasGauge score={analysis.biasScore} />
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${leaningClass}`}>
                  {analysis.leaning}
                </span>
                <span className="inline-flex rounded-full border border-[var(--app-border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-medium text-[var(--app-muted)]">
                  Credibility: {analysis.credibilityScore}/100
                </span>
                <span className="inline-flex rounded-full border border-[var(--app-border)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-medium text-[var(--app-muted)]">
                  Confidence: {analysis.confidence}%
                </span>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--app-muted)]">
                {analysis.overallAssessment}
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-6 rounded-[20px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Neutral Summary</p>
          <p className="text-[15px] leading-7 text-[var(--app-foreground)]">{analysis.summary}</p>
        </div>

        {analysis.headlineAnalysis && (
          <div className="mt-4 rounded-[20px] border border-[var(--accent-border)] bg-[var(--accent-soft)] p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]">Headline Analysis</p>
            <p className="text-sm leading-6 text-[var(--app-foreground)]">{analysis.headlineAnalysis}</p>
          </div>
        )}
      </div>

      {/* Grid Details */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Framing */}
        <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-border)] text-xs">🎯</span>
            Framing Techniques
            <span className="ml-auto rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs normal-case tracking-normal">{analysis.framing.length}</span>
          </h4>
          <div className="space-y-4">
            {analysis.framing.length === 0 && <p className="text-sm text-[var(--app-muted)]">No major framing detected - relatively neutral presentation.</p>}
            {analysis.framing.map((f, i) => (
              <div key={i} className="rounded-[18px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-4">
                <p className="text-sm font-semibold text-[var(--app-foreground)]">{f.technique}</p>
                <p className="mt-2 rounded-lg bg-[var(--app-background)] px-3 py-2 text-xs italic leading-5 text-[var(--app-muted)]">"{f.example}"</p>
                <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{f.explanation}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Loaded Language */}
        <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6">
          <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--app-border)] text-xs">⚡</span>
            Loaded Language
            <span className="ml-auto rounded-full bg-[var(--surface-soft)] px-2.5 py-1 text-xs normal-case tracking-normal">{analysis.loadedLanguage.length}</span>
          </h4>
          <div className="space-y-4">
            {analysis.loadedLanguage.length === 0 && <p className="text-sm text-[var(--app-muted)]">No emotionally loaded language detected.</p>}
            {analysis.loadedLanguage.map((l, i) => (
              <div key={i} className="rounded-[18px] border border-[var(--app-border)] bg-[var(--surface-soft)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--app-foreground)]">"{l.phrase}"</p>
                  <SeverityBadge severity={l.severity} />
                </div>
                <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]"><span className="font-semibold text-[var(--app-foreground)]">Context:</span> {l.context}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--app-muted)]"><span className="font-semibold text-[var(--app-foreground)]">Impact:</span> {l.impact}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Missing Context */}
        <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6">
          <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Missing Context</h4>
          <ul className="space-y-3">
            {analysis.missingContext.length === 0 && <li className="text-sm text-[var(--app-muted)]">No major gaps identified.</li>}
            {analysis.missingContext.map((m, i) => (
              <li key={i} className="flex gap-3 rounded-[14px] border border-[var(--app-border)] bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--app-foreground)]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-strong)]" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sources & Takeaways */}
        <div className="space-y-6">
          <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Sources to Verify</h4>
            <ul className="space-y-2">
              {analysis.sourcesToCheck.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm leading-6 text-[var(--app-muted)]">
                  <span className="text-[var(--accent-strong)]">↳</span> {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-[var(--app-border)] bg-[var(--surface-raised)] p-6">
            <h4 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--app-muted)]">Key Takeaways</h4>
            <ul className="space-y-2">
              {analysis.keyTakeaways.map((k, i) => (
                <li key={i} className="flex gap-3 text-sm leading-6 text-[var(--app-foreground)]">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-strong)] text-xs font-bold text-white">{i+1}</span>
                  <span>{k}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
