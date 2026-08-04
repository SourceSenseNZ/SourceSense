export const runtime = "nodejs";
export const maxDuration = 10;

import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";

// EMERGENCY: Skip Supabase entirely to guarantee <5 sec response for showcase
// This bypasses thread creation so showcase works even if Supabase cold/slow
// After showcase, revert to version with Supabase

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { article } = body;
    if (!article || article.trim().length < 20) {
      return NextResponse.json({ error: "Too short" }, { status: 400 });
    }

    const key = process.env.OPENAI_API_KEY || "";
    if (!key.startsWith("sk-")) {
      return NextResponse.json({ error: "OPENAI_API_KEY missing - add in Vercel and redeploy" }, { status: 500 });
    }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: key, timeout: 9000, maxRetries: 0 });

    const trimmed = article.slice(0, 2000);
    const prompt = `Analyze for bias. Return ONLY JSON: {"biasScore":0-100,"leaning":"Far Left|Left|Centre-left|Centre|Centre-right|Right|Far Right","confidence":0-100,"summary":"3 sentence neutral","headlineAnalysis":"...","framing":[{"technique":"...","example":"quote","explanation":"..."}],"loadedLanguage":[{"phrase":"...","context":"...","impact":"...","severity":"low|medium|high"}],"missingContext":["..."],"sourcesToCheck":["..."],"credibilityScore":0-100,"overallAssessment":"...","keyTakeaways":["..."]} Article: ${trimmed}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 800,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || raw);

      const analysis: ArticleAnalysis = {
        biasScore: Number(parsed.biasScore) || 55,
        leaning: parsed.leaning || "Centre",
        confidence: parsed.confidence || 75,
        summary: parsed.summary || "Done",
        headlineAnalysis: parsed.headlineAnalysis || "",
        framing: (parsed.framing || []).slice(0,3),
        loadedLanguage: (parsed.loadedLanguage || []).slice(0,3),
        missingContext: (parsed.missingContext || []).slice(0,3),
        sourcesToCheck: (parsed.sourcesToCheck || []).slice(0,3),
        credibilityScore: parsed.credibilityScore || 70,
        overallAssessment: parsed.overallAssessment || "",
        keyTakeaways: (parsed.keyTakeaways || []).slice(0,3),
      };

      // Don't save to Supabase for speed in demo - just return analysis directly
      // This guarantees it works even if Supabase is slow/paused
      return NextResponse.json({ 
        threadId: "demo-" + Date.now(),
        analysis,
        demoMode: true,
        message: "Demo mode: not saved to DB for speed - will save after showcase"
      });

    } catch (aiErr: any) {
      console.error("OpenAI error:", aiErr?.message, aiErr?.status);
      return NextResponse.json({ 
        error: `OpenAI error [${aiErr?.status || ""}] ${aiErr?.code || ""}: ${aiErr?.message}. Key ${key.slice(0,12)}... Credits $10? Check platform.openai.com -> Billing -> Credit balance` 
      }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
