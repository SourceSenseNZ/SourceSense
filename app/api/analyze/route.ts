export const runtime = "nodejs";
export const maxDuration = 10; // Hobby limit - must finish under 10s

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { openai, ANALYSIS_SYSTEM_PROMPT, ANALYSIS_JSON_SCHEMA, getMockAnalysis, withTimeout, PRIMARY_MODEL } from "@/lib/openai";
import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { article, userId: clientUserId, title: clientTitle, url } = body;

    if (!article || typeof article !== "string" || article.trim().length < 50) {
      return NextResponse.json({ error: "Article too short - min 50 chars" }, { status: 400 });
    }

    const trimmedArticle = article.length > 6000 ? article.slice(0, 6000) + "\n\n[Truncated]" : article;

    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = supabaseAdmin();

    let title = clientTitle?.trim();
    if (!title) {
      const firstLine = trimmedArticle.trim().split("\n")[0].trim();
      title = firstLine.length > 15 && firstLine.length < 100 ? firstLine.slice(0, 80) : trimmedArticle.slice(0, 50).replace(/\s+/g, " ") + "...";
    }

    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .insert({ user_id: userId, title })
      .select()
      .single();

    if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });

    const { error: userMessageError } = await supabase.from("messages").insert({
      thread_id: thread.id,
      role: "user",
      content: article,
    });
    if (userMessageError) return NextResponse.json({ error: userMessageError.message }, { status: 500 });

    // Fast path: check key valid format
    const rawKey = process.env.OPENAI_API_KEY || "";
    const hasKey = rawKey.startsWith("sk-") && rawKey.length > 20;

    let analysis: ArticleAnalysis;

    if (!hasKey) {
      console.log("No valid OPENAI_API_KEY, using mock immediately");
      analysis = getMockAnalysis(trimmedArticle) as ArticleAnalysis;
      (analysis as any).isMock = true;
      (analysis as any).mockReason = "OPENAI_API_KEY missing in Vercel env";
    } else {
      try {
        const inputText = url ? `URL: ${url}\n\nARTICLE:\n${trimmedArticle}` : trimmedArticle;

        // Use chat.completions for speed & reliability vs responses.parse (responses can be slower)
        // Try chat completions with json response first for speed
        const chatPromise = openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: [
            { role: "system", content: ANALYSIS_SYSTEM_PROMPT + " Return ONLY valid JSON matching schema." },
            { role: "user", content: inputText },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 1800,
        });

        // CRITICAL: 7.5 second timeout to stay under Vercel 10s Hobby limit
        const chatResponse = await withTimeout(chatPromise, 7500, "OpenAI chat timeout 7.5s");

        const content = chatResponse.choices[0]?.message?.content || "";
        if (!content) throw new Error("Empty OpenAI response");

        // Parse JSON - try direct parse, fallback to extracting json block
        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
          else throw new Error("Invalid JSON from OpenAI");
        }

        // Validate required fields, fill defaults if missing
        analysis = {
          biasScore: typeof parsed.biasScore === "number" ? parsed.biasScore : 50,
          leaning: parsed.leaning || "Centre",
          confidence: parsed.confidence || 70,
          summary: parsed.summary || content.slice(0, 300),
          headlineAnalysis: parsed.headlineAnalysis || "Headline analysis unavailable",
          framing: Array.isArray(parsed.framing) ? parsed.framing : [],
          loadedLanguage: Array.isArray(parsed.loadedLanguage) ? parsed.loadedLanguage : [],
          missingContext: Array.isArray(parsed.missingContext) ? parsed.missingContext : [],
          sourcesToCheck: Array.isArray(parsed.sourcesToCheck) ? parsed.sourcesToCheck : [],
          credibilityScore: parsed.credibilityScore || 60,
          overallAssessment: parsed.overallAssessment || "Analysis completed",
          keyTakeaways: Array.isArray(parsed.keyTakeaways) ? parsed.keyTakeaways : [],
        } as ArticleAnalysis;

        console.log(`Real analysis OK in ${Date.now() - startTime}ms`);

      } catch (openaiError: any) {
        const errMsg = openaiError?.message || String(openaiError);
        console.error(`OpenAI failed after ${Date.now() - startTime}ms:`, errMsg);

        // Always fallback to mock so frontend never spins forever
        analysis = getMockAnalysis(trimmedArticle) as ArticleAnalysis;
        (analysis as any).isMock = true;
        (analysis as any).mockReason = errMsg.slice(0, 300);
        (analysis as any).isFallback = true;
      }
    }

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("messages")
      .insert({
        thread_id: thread.id,
        role: "assistant",
        content: analysis.summary,
        analysis_json: analysis,
      })
      .select()
      .single();

    if (assistantMessageError) {
      // Try without jsonb column if missing
      if (assistantMessageError.message.includes("analysis_json")) {
        const { data: fallbackMsg } = await supabase
          .from("messages")
          .insert({ thread_id: thread.id, role: "assistant", content: JSON.stringify(analysis, null, 2) })
          .select()
          .single();
        return NextResponse.json({ threadId: thread.id, analysis, message: fallbackMsg, warning: "Need: alter table messages add column analysis_json jsonb" });
      }
      return NextResponse.json({ error: assistantMessageError.message }, { status: 500 });
    }

    return NextResponse.json({ threadId: thread.id, analysis, message: assistantMessage });
  } catch (err: any) {
    console.error("Unexpected error in /api/analyze:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
