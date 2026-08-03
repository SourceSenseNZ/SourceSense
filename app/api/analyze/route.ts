export const runtime = "nodejs";
export const maxDuration = 25; // allow up to 25s on hobby? Vercel will cap to 10s on hobby but we set higher for pro

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { openai, ANALYSIS_SYSTEM_PROMPT, ANALYSIS_JSON_SCHEMA, getMockAnalysis, withTimeout, PRIMARY_MODEL, FALLBACK_MODEL } from "@/lib/openai";
import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { article, userId: clientUserId, title: clientTitle, url } = body;

    if (!article || typeof article !== "string" || article.trim().length < 50) {
      return NextResponse.json(
        { error: "Article too short - please paste at least 50 characters" },
        { status: 400 }
      );
    }

    // Trim article to prevent timeout on huge articles - keep first 8000 chars for demo
    const trimmedArticle = article.length > 8000 ? article.slice(0, 8000) + "\n\n[Truncated for analysis - original was longer]" : article;

    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) {
      userId = clientUserId;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized - no user ID" }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    let title = clientTitle?.trim();
    if (!title) {
      const firstLine = trimmedArticle.trim().split("\n")[0].trim();
      if (firstLine.length > 15 && firstLine.length < 120) {
        title = firstLine.slice(0, 80);
      } else {
        title = trimmedArticle.trim().slice(0, 60).replace(/\s+/g, " ").trim();
        if (trimmedArticle.length > 60) title += "...";
      }
    }

    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .insert({ user_id: userId, title })
      .select()
      .single();

    if (threadError) {
      console.error("Thread insert error:", threadError);
      if (threadError.message.includes("title")) {
        return NextResponse.json(
          { error: `DB needs: alter table threads add column title text; ${threadError.message}` },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: threadError.message }, { status: 500 });
    }

    const { error: userMessageError } = await supabase.from("messages").insert({
      thread_id: thread.id,
      role: "user",
      content: article, // save full original
    });

    if (userMessageError) {
      return NextResponse.json({ error: userMessageError.message }, { status: 500 });
    }

    let analysis: ArticleAnalysis;
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith("sk-");

    if (!hasOpenAIKey) {
      console.warn("OPENAI_API_KEY missing or invalid format - using mock");
      analysis = getMockAnalysis(trimmedArticle) as ArticleAnalysis;
      (analysis as any).isMock = true;
    } else {
      try {
        const inputText = url ? `URL: ${url}\n\nARTICLE:\n${trimmedArticle}` : trimmedArticle;

        // Try primary model with timeout to prevent Vercel 10s hang
        let response;
        try {
          const openaiPromise = openai.responses.parse({
            model: PRIMARY_MODEL,
            input: [
              { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
              { role: "user", content: inputText },
            ],
            text: {
              format: {
                type: "json_schema",
                name: "article_analysis",
                strict: true,
                schema: ANALYSIS_JSON_SCHEMA,
              },
            },
          });
          // 18s timeout wrapper (less than Vercel max but enough for analysis)
          response = await withTimeout(openaiPromise, 18000, "OpenAI timeout after 18s");
        } catch (primaryError) {
          const msg = primaryError instanceof Error ? primaryError.message : String(primaryError);
          console.warn(`Primary model ${PRIMARY_MODEL} failed: ${msg}, trying fallback ${FALLBACK_MODEL}`);
          // Try fallback model if primary fails and not timeout
          if (!msg.toLowerCase().includes("timeout")) {
            const fallbackPromise = openai.responses.parse({
              model: FALLBACK_MODEL,
              input: [
                { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
                { role: "user", content: inputText },
              ],
              text: {
                format: {
                  type: "json_schema",
                  name: "article_analysis",
                  strict: true,
                  schema: ANALYSIS_JSON_SCHEMA,
                },
              },
            });
            response = await withTimeout(fallbackPromise, 15000, "Fallback model timeout");
          } else {
            throw primaryError;
          }
        }

        const parsed = (response as any).output_parsed as ArticleAnalysis | null;
        if (!parsed) throw new Error("OpenAI returned empty analysis");
        analysis = parsed;

        console.log(`Analysis success in ${Date.now() - startTime}ms using ${PRIMARY_MODEL}`);

      } catch (openaiError: unknown) {
        const errMsg = openaiError instanceof Error ? openaiError.message : "OpenAI error";
        console.error("OpenAI error:", errMsg, openaiError);

        // Fallback to mock instead of failing - so UI never gets stuck analysing forever
        if (
          errMsg.toLowerCase().includes("api key") ||
          errMsg.toLowerCase().includes("billing") ||
          errMsg.toLowerCase().includes("quota") ||
          errMsg.includes("429") ||
          errMsg.toLowerCase().includes("timeout") ||
          errMsg.toLowerCase().includes("insufficient")
        ) {
          console.warn("Falling back to mock due to OpenAI issue:", errMsg);
          analysis = getMockAnalysis(trimmedArticle) as ArticleAnalysis;
          (analysis as any).isMock = true;
          (analysis as any).mockReason = errMsg.slice(0, 200);
        } else {
          // For other errors, still fallback to mock for demo stability but include warning
          analysis = getMockAnalysis(trimmedArticle) as ArticleAnalysis;
          (analysis as any).isMock = true;
          (analysis as any).mockReason = errMsg.slice(0, 200);
        }
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
      console.error("Assistant message insert error:", assistantMessageError);
      if (assistantMessageError.message.includes("analysis_json")) {
        const { data: fallbackMsg } = await supabase
          .from("messages")
          .insert({
            thread_id: thread.id,
            role: "assistant",
            content: JSON.stringify(analysis, null, 2),
          })
          .select()
          .single();

        return NextResponse.json({
          threadId: thread.id,
          analysis,
          message: fallbackMsg,
          warning: "DB needs: alter table messages add column if not exists analysis_json jsonb;",
        });
      }
      return NextResponse.json({ error: assistantMessageError.message }, { status: 500 });
    }

    return NextResponse.json({
      threadId: thread.id,
      analysis,
      message: assistantMessage,
    });
  } catch (err: unknown) {
    console.error("Unexpected server error in /api/analyze:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 }
    );
  }
}
