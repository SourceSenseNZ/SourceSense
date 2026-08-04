export const runtime = "nodejs";
export const maxDuration = 10;

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";

export async function POST(req: Request) {
  const t0 = Date.now();
  try {
    const body = await req.json();
    const { article, userId: clientUserId, title: clientTitle } = body;
    if (!article || article.trim().length < 20) return NextResponse.json({ error: "Too short" }, { status: 400 });
    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = supabaseAdmin();
    const title = (clientTitle?.trim() || article.slice(0, 50)).slice(0, 80);
    const { data: thread } = await supabase.from("threads").insert({ user_id: userId, title }).select().single();
    if (!thread) return NextResponse.json({ error: "Thread fail" }, { status: 500 });
    
    const key = process.env.OPENAI_API_KEY || "";
    if (!key.startsWith("sk-")) return NextResponse.json({ error: "OPENAI_API_KEY missing - add in Vercel" }, { status: 500 });

    // Try real OpenAI with 8 sec timeout (max for Hobby 10 sec)
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: key, timeout: 8000, maxRetries: 0 });
      const trimmed = article.slice(0, 2000);
      const prompt = `Analyze for bias. Return ONLY JSON: {"biasScore":0-100,"leaning":"Far Left|Left|Centre-left|Centre|Centre-right|Right|Far Right","confidence":0-100,"summary":"3 sentence neutral","headlineAnalysis":"...","framing":[{"technique":"...","example":"quote","explanation":"..."}],"loadedLanguage":[{"phrase":"...","context":"...","impact":"...","severity":"low|medium|high"}],"missingContext":["..."],"sourcesToCheck":["..."],"credibilityScore":0-100,"overallAssessment":"...","keyTakeaways":["..."]} Article: ${trimmed}`;
      
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
        biasScore: Number(parsed.biasScore) || 50,
        leaning: parsed.leaning || "Centre",
        confidence: parsed.confidence || 75,
        summary: parsed.summary || "Done",
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
      console.log(`Real AI OK in ${Date.now()-t0}ms`);
      return NextResponse.json({ threadId: thread.id, analysis });
      
    } catch (aiErr: any) {
      console.error(`AI fail ${Date.now()-t0}ms:`, aiErr?.message, aiErr?.status, aiErr?.code);
      // Return the REAL OpenAI error so you know if it's billing, invalid key, etc.
      return NextResponse.json({ error: `OpenAI error [${aiErr?.status || "no status"}] ${aiErr?.code || ""}: ${aiErr?.message || String(aiErr)}. Key ${key.slice(0,12)}... Billing enabled? Check platform.openai.com -> Billing -> Credits` }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
