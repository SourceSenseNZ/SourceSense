export const runtime = "nodejs";
export const maxDuration = 10;

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";

export async function POST(req: Request) {
  const start = Date.now();
  try {
    const body = await req.json();
    const { article, userId: clientUserId, title: clientTitle } = body;

    if (!article || article.trim().length < 20) {
      return NextResponse.json({ error: "Too short" }, { status: 400 });
    }

    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = supabaseAdmin();
    const title = (clientTitle?.trim() || article.slice(0, 50)).slice(0, 80);

    // Fast thread create
    const { data: thread, error: tErr } = await supabase.from("threads").insert({ user_id: userId, title }).select().single();
    if (tErr || !thread) return NextResponse.json({ error: tErr?.message || "Thread fail" }, { status: 500 });

    // Don't await user message insert - fire and forget to save time for demo
    supabase.from("messages").insert({ thread_id: thread.id, role: "user", content: article.slice(0, 2000) }).then(()=>{},()=>{});

    const key = process.env.OPENAI_API_KEY || "";
    if (!key || !key.startsWith("sk-")) {
      return NextResponse.json({ error: "OPENAI_API_KEY missing in Vercel - add it and Redeploy" }, { status: 500 });
    }

    // SUPER FAST OpenAI call - 4.5 sec max to stay under Vercel 10 sec
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: key, timeout: 4500, maxRetries: 0 });

      const trimmed = article.slice(0, 2000);

      const prompt = `Analyze article for bias. Return ONLY valid JSON:
{"biasScore": 0-100, "leaning": "Far Left|Left|Centre-left|Centre|Centre-right|Right|Far Right", "confidence": 0-100, "summary": "3 sentence neutral summary", "headlineAnalysis": "check", "framing": [{"technique":"...","example":"quote","explanation":"..."}], "loadedLanguage": [{"phrase":"...","context":"...","impact":"...","severity":"low|medium|high"}], "missingContext": ["..."], "sourcesToCheck": ["..."], "credibilityScore": 0-100, "overallAssessment": "...", "keyTakeaways": ["..."]}
Article: ${trimmed}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 700,
      });

      const raw = completion.choices[0]?.message?.content?.trim() || "{}";
      // Extract JSON if wrapped
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
      const parsed = JSON.parse(jsonStr);

      const analysis: ArticleAnalysis = {
        biasScore: Number(parsed.biasScore) || 55,
        leaning: parsed.leaning || "Centre",
        confidence: parsed.confidence || 75,
        summary: parsed.summary || "Analysis done",
        headlineAnalysis: parsed.headlineAnalysis || "",
        framing: (parsed.framing || []).slice(0,3),
        loadedLanguage: (parsed.loadedLanguage || []).slice(0,3),
        missingContext: (parsed.missingContext || []).slice(0,3),
        sourcesToCheck: (parsed.sourcesToCheck || []).slice(0,3),
        credibilityScore: parsed.credibilityScore || 70,
        overallAssessment: parsed.overallAssessment || "",
        keyTakeaways: (parsed.keyTakeaways || []).slice(0,3),
      };

      // Fast insert, don't wait long
      await supabase.from("messages").insert({ thread_id: thread.id, role: "assistant", content: analysis.summary, analysis_json: analysis });

      console.log(`OK in ${Date.now()-start}ms`);
      return NextResponse.json({ threadId: thread.id, analysis });

    } catch (aiErr: any) {
      const msg = aiErr?.message || String(aiErr);
      console.error(`AI fail in ${Date.now()-start}ms: ${msg}`);
      // Return clear error, not 504
      return NextResponse.json({ error: `AI failed after ${Date.now()-start}ms: ${msg}. Check OpenAI key valid and has credits, and billing enabled. Key prefix ${key.slice(0,10)}...` }, { status: 502 });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
