export const runtime = "nodejs";

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { openai, ANALYSIS_SYSTEM_PROMPT, ANALYSIS_JSON_SCHEMA, getMockAnalysis } from "@/lib/openai";
import { NextResponse } from "next/server";
import type { ArticleAnalysis } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { article, userId: clientUserId, title: clientTitle, url } = body;

    if (!article || typeof article !== "string" || article.trim().length < 50) {
      return NextResponse.json(
        { error: "Article too short - please paste at least 50 characters" },
        { status: 400 }
      );
    }

    // Auth: try Bearer token first (secure), fallback to clientUserId (legacy compatibility)
    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) {
      userId = clientUserId;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized - no user ID" }, { status: 401 });
    }

    const supabase = supabaseAdmin();

    // Generate clean title from article or use provided
    let title = clientTitle?.trim();
    if (!title) {
      // Take first line or first 60 chars, clean up
      const firstLine = article.trim().split("\n")[0].trim();
      if (firstLine.length > 15 && firstLine.length < 120) {
        title = firstLine.slice(0, 80);
      } else {
        title = article.trim().slice(0, 60).replace(/\s+/g, " ").trim();
        if (article.length > 60) title += "...";
      }
    }

    // 1. Create thread
    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        title: title,
      })
      .select()
      .single();

    if (threadError) {
      console.error("Thread insert error:", threadError);
      // Common error: missing title column from legacy DB
      if (threadError.message.includes("title")) {
        return NextResponse.json(
          {
            error: `DB schema missing title column. Run: alter table threads add column title text; Raw: ${threadError.message}`,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ error: threadError.message }, { status: 500 });
    }

    // 2. Save user message (original article)
    const { error: userMessageError } = await supabase.from("messages").insert({
      thread_id: thread.id,
      role: "user",
      content: article,
    });

    if (userMessageError) {
      console.error("User message insert error:", userMessageError);
      return NextResponse.json({ error: userMessageError.message }, { status: 500 });
    }

    // 3. OpenAI Analysis - Real integration with fallback
    let analysis: ArticleAnalysis;

    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (!hasOpenAIKey) {
      console.warn("OPENAI_API_KEY missing - using mock analysis");
      analysis = getMockAnalysis(article) as ArticleAnalysis;
    } else {
      try {
        const inputText = url
          ? `URL: ${url}\n\nARTICLE:\n${article}`
          : article;

        const response = await openai.responses.parse({
          model: "gpt-4.1-mini",
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

        const parsed = response.output_parsed as ArticleAnalysis | null;

        if (!parsed) {
          throw new Error("OpenAI returned empty analysis");
        }

        analysis = parsed;
      } catch (openaiError: unknown) {
        const errMsg = openaiError instanceof Error ? openaiError.message : "OpenAI error";
        console.error("OpenAI error:", openaiError);

        // If OpenAI fails due to quota/auth, fall back to mock so app still works
        if (errMsg.toLowerCase().includes("api key") || errMsg.includes("429")) {
          analysis = getMockAnalysis(article) as ArticleAnalysis;
        } else {
          return NextResponse.json(
            { error: `AI analysis failed: ${errMsg}` },
            { status: 502 }
          );
        }
      }
    }

    // 4. Save assistant message with structured JSON
    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("messages")
      .insert({
        thread_id: thread.id,
        role: "assistant",
        content: analysis.summary, // Keep summary as main content for compatibility
        analysis_json: analysis,
      })
      .select()
      .single();

    if (assistantMessageError) {
      console.error("Assistant message insert error:", assistantMessageError);
      // If column missing, try without analysis_json and tell user to migrate
      if (assistantMessageError.message.includes("analysis_json")) {
        // Retry without JSON column
        const { data: fallbackMsg, error: fallbackError } = await supabase
          .from("messages")
          .insert({
            thread_id: thread.id,
            role: "assistant",
            content: JSON.stringify(analysis, null, 2),
          })
          .select()
          .single();

        if (fallbackError) {
          return NextResponse.json({ error: fallbackError.message }, { status: 500 });
        }

        return NextResponse.json({
          threadId: thread.id,
          analysis,
          message: fallbackMsg,
          warning:
            "DB missing analysis_json column. Run: alter table messages add column if not exists analysis_json jsonb;",
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
      {
        error: err instanceof Error ? err.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
