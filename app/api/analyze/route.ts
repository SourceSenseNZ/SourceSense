export const runtime = "nodejs";
export const maxDuration = 10;

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { getMockAnalysis } from "@/lib/openai";
import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";

// FOR SCHOOL SHOWCASE - set to true for 100% instant mock that never calls OpenAI and never spins
// After showcase, set to false to re-enable real AI
const FORCE_MOCK_FOR_DEMO = true;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { article, userId: clientUserId, title: clientTitle } = body;

    if (!article || typeof article !== "string" || article.trim().length < 20) {
      return NextResponse.json({ error: "Paste at least 20 chars" }, { status: 400 });
    }

    const trimmed = article.slice(0, 3000);
    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = supabaseAdmin();
    let title = clientTitle?.trim() || trimmed.split("\n")[0].slice(0, 60);

    const { data: thread, error: threadError } = await supabase.from("threads").insert({ user_id: userId, title }).select().single();
    if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

    await supabase.from("messages").insert({ thread_id: thread.id, role: "user", content: article });

    let analysis: ArticleAnalysis;

    if (FORCE_MOCK_FOR_DEMO) {
      // GUARANTEED INSTANT - no OpenAI call at all, so it can NEVER spin forever
      analysis = getMockAnalysis(trimmed) as ArticleAnalysis;
      (analysis as any).isDemoMock = true;
      (analysis as any).mockReason = "Demo mode - guaranteed instant for showcase";
    } else {
      const hasKey = (process.env.OPENAI_API_KEY || "").startsWith("sk-");
      if (!hasKey) {
        analysis = getMockAnalysis(trimmed) as ArticleAnalysis;
        (analysis as any).isMock = true;
      } else {
        try {
          const { openai, ANALYSIS_SYSTEM_PROMPT } = await import("@/lib/openai");
          const chat = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: ANALYSIS_SYSTEM_PROMPT + " Return ONLY JSON." },
              { role: "user", content: trimmed },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
            max_tokens: 800,
          });
          const content = chat.choices[0]?.message?.content || "{}";
          const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || "{}");
          analysis = {
            biasScore: parsed.biasScore ?? 55,
            leaning: parsed.leaning || "Centre",
            confidence: parsed.confidence || 75,
            summary: parsed.summary || "Real analysis completed",
            headlineAnalysis: parsed.headlineAnalysis || "Headline matches",
            framing: parsed.framing || [],
            loadedLanguage: parsed.loadedLanguage || [],
            missingContext: parsed.missingContext || [],
            sourcesToCheck: parsed.sourcesToCheck || [],
            credibilityScore: parsed.credibilityScore || 70,
            overallAssessment: parsed.overallAssessment || "Shows some framing",
            keyTakeaways: parsed.keyTakeaways || [],
          } as ArticleAnalysis;
        } catch (e: any) {
          analysis = getMockAnalysis(trimmed) as ArticleAnalysis;
          (analysis as any).isMock = true;
          (analysis as any).mockReason = e?.message?.slice(0,200);
        }
      }
    }

    const { data: assistantMessage } = await supabase.from("messages").insert({
      thread_id: thread.id, role: "assistant", content: analysis.summary, analysis_json: analysis
    }).select().single();

    return NextResponse.json({ threadId: thread.id, analysis, message: assistantMessage });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
