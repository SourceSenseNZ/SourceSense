export const runtime = "nodejs";
export const maxDuration = 10;

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { getMockAnalysis } from "@/lib/openai";
import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";

// EMERGENCY DEMO MODE - Set to false to re-enable real OpenAI after showcase
const DEMO_MODE_FORCE_MOCK = false; // Set to true for 100% guaranteed demo that never fails

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const body = await req.json();
    const { article, userId: clientUserId, title: clientTitle } = body;

    if (!article || typeof article !== "string" || article.trim().length < 30) {
      return NextResponse.json({ error: "Article too short - min 30 chars" }, { status: 400 });
    }

    // Fast trim for speed
    const trimmed = article.length > 4000 ? article.slice(0, 4000) + "\n[Truncated]" : article;

    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = supabaseAdmin();

    let title = clientTitle?.trim();
    if (!title) {
      const firstLine = trimmed.split("\n")[0].trim();
      title = firstLine.length > 10 && firstLine.length < 80 ? firstLine : trimmed.slice(0, 40) + "...";
    }

    // Create thread - fast
    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .insert({ user_id: userId, title })
      .select()
      .single();

    if (threadError) {
      console.error("Thread error:", threadError.message);
      return NextResponse.json({ error: threadError.message }, { status: 500 });
    }

    // Save user message - don't await long, fire and forget for speed, but await for now with timeout
    await supabase.from("messages").insert({ thread_id: thread.id, role: "user", content: article }).then(() => {}, () => {});

    let analysis: ArticleAnalysis;

    // DEMO MODE: instant mock for guaranteed showcase
    if (DEMO_MODE_FORCE_MOCK) {
      analysis = getMockAnalysis(trimmed) as ArticleAnalysis;
      (analysis as any).isDemoMock = true;
    } else {
      // Try real OpenAI with very aggressive timeout, fallback to mock instantly if fails
      const hasKey = (process.env.OPENAI_API_KEY || "").startsWith("sk-") && (process.env.OPENAI_API_KEY?.length || 0) > 20;
      
      if (!hasKey) {
        analysis = getMockAnalysis(trimmed) as ArticleAnalysis;
        (analysis as any).isMock = true;
        (analysis as any).mockReason = "No OPENAI_API_KEY - using demo mock";
      } else {
        try {
          // Dynamically import openai only if needed to save cold start time
          const { openai, ANALYSIS_SYSTEM_PROMPT } = await import("@/lib/openai");
          
          const inputText = trimmed;

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000); // 5 sec HARD limit

          try {
            const chat = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: ANALYSIS_SYSTEM_PROMPT + " Return ONLY JSON." },
                { role: "user", content: inputText },
              ],
              response_format: { type: "json_object" },
              temperature: 0.2,
              max_tokens: 1200,
            }, { signal: controller.signal as any });

            clearTimeout(timeout);

            const content = chat.choices[0]?.message?.content || "";
            let parsed: any;
            try {
              parsed = JSON.parse(content);
            } catch {
              const m = content.match(/\{[\s\S]*\}/);
              parsed = m ? JSON.parse(m[0]) : null;
            }

            if (!parsed || typeof parsed.biasScore !== "number") throw new Error("Invalid parsed");

            analysis = {
              biasScore: parsed.biasScore ?? 50,
              leaning: parsed.leaning || "Centre",
              confidence: parsed.confidence || 70,
              summary: parsed.summary || "Analysis completed",
              headlineAnalysis: parsed.headlineAnalysis || "Headline matches body",
              framing: Array.isArray(parsed.framing) ? parsed.framing.slice(0, 3) : [],
              loadedLanguage: Array.isArray(parsed.loadedLanguage) ? parsed.loadedLanguage.slice(0, 3) : [],
              missingContext: Array.isArray(parsed.missingContext) ? parsed.missingContext.slice(0, 3) : [],
              sourcesToCheck: Array.isArray(parsed.sourcesToCheck) ? parsed.sourcesToCheck.slice(0, 3) : [],
              credibilityScore: parsed.credibilityScore || 65,
              overallAssessment: parsed.overallAssessment || "Analysis shows some framing",
              keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways.slice(0, 3) : [],
            } as ArticleAnalysis;

          } catch (e: any) {
            clearTimeout(timeout);
            console.warn(`OpenAI failed in ${Date.now() - start}ms:`, e?.message);
            analysis = getMockAnalysis(trimmed) as ArticleAnalysis;
            (analysis as any).isMock = true;
            (analysis as any).mockReason = e?.message?.slice(0, 200) || "OpenAI timeout/fail";
            (analysis as any).isFallback = true;
          }
        } catch (importError) {
          console.error("Import openai failed:", importError);
          analysis = getMockAnalysis(trimmed) as ArticleAnalysis;
          (analysis as any).isMock = true;
        }
      }
    }

    console.log(`Total analyze time: ${Date.now() - start}ms, mock=${(analysis as any).isMock ? "yes" : "no"}`);

    const { data: assistantMessage } = await supabase
      .from("messages")
      .insert({ thread_id: thread.id, role: "assistant", content: analysis.summary, analysis_json: analysis })
      .select()
      .single();

    return NextResponse.json({ threadId: thread.id, analysis, message: assistantMessage });

  } catch (err: any) {
    console.error("Fatal analyze error:", err?.message);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
