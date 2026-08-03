export const runtime = "nodejs";
export const maxDuration = 10;

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";
import { getMockAnalysis } from "@/lib/openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { article, userId: clientUserId, title: clientTitle } = body;

    if (!article || typeof article !== "string" || article.trim().length < 20) {
      return NextResponse.json({ error: "Paste at least 20 chars" }, { status: 400 });
    }

    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = supabaseAdmin();
    let title = clientTitle?.trim() || article.split("\n")[0].slice(0, 60);
    const { data: thread } = await supabase.from("threads").insert({ user_id: userId, title }).select().single();
    if (!thread) return NextResponse.json({ error: "Thread create failed" }, { status: 500 });
    
    await supabase.from("messages").insert({ thread_id: thread.id, role: "user", content: article });

    // REAL AI - NO MOCK unless OpenAI fails
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey || !openaiKey.startsWith("sk-")) {
      return NextResponse.json({ error: "OPENAI_API_KEY missing in Vercel - add it in Env Vars and Redeploy" }, { status: 500 });
    }

    // Import here to not slow cold start
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: openaiKey, timeout: 8000 });

    const trimmed = article.slice(0, 3000);

    const prompt = `You are SourceSense media bias analyzer. Analyze article for bias. Return ONLY JSON with this exact structure:
{
  "biasScore": number 0-100,
  "leaning": "Far Left"|"Left"|"Centre-left"|"Centre"|"Centre-right"|"Right"|"Far Right",
  "confidence": number,
  "summary": "3 sentence neutral summary",
  "headlineAnalysis": "headline vs body check",
  "framing": [{"technique": "...", "example": "quote", "explanation": "..."}],
  "loadedLanguage": [{"phrase": "...", "context": "...", "impact": "...", "severity": "low"|"medium"|"high"}],
  "missingContext": ["..."],
  "sourcesToCheck": ["..."],
  "credibilityScore": number,
  "overallAssessment": "...",
  "keyTakeaways": ["..."]
}
Be specific, cite actual phrases from article. Article: ${trimmed}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1500,
      });

      const raw = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(raw);

      const analysis: ArticleAnalysis = {
        biasScore: parsed.biasScore ?? 50,
        leaning: parsed.leaning || "Centre",
        confidence: parsed.confidence || 75,
        summary: parsed.summary || "Analysis complete",
        headlineAnalysis: parsed.headlineAnalysis || "",
        framing: parsed.framing || [],
        loadedLanguage: parsed.loadedLanguage || [],
        missingContext: parsed.missingContext || [],
        sourcesToCheck: parsed.sourcesToCheck || [],
        credibilityScore: parsed.credibilityScore || 70,
        overallAssessment: parsed.overallAssessment || "",
        keyTakeaways: parsed.keyTakeaways || [],
      };

      await supabase.from("messages").insert({ thread_id: thread.id, role: "assistant", content: analysis.summary, analysis_json: analysis });

      return NextResponse.json({ threadId: thread.id, analysis });

    } catch (aiError: any) {
      console.error("OpenAI error:", aiError?.message, aiError?.status);
      // Return REAL error so frontend shows why, not infinite spinner
      return NextResponse.json({ 
        error: `AI failed: ${aiError?.message || "Unknown"} - Check OpenAI billing and key is valid and has credits. Key starts with ${openaiKey.slice(0,8)}...`,
        details: aiError?.message
      }, { status: 502 });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
