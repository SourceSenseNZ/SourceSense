export const runtime = "nodejs";

import { openai } from "@/lib/openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ArticleAnalysis = {
  biasScore: number;
  leaning: string;
  summary: string;
  framing: string[];
  loadedLanguage: string[];
  missingContext: string[];
  overallAssessment: string;
};

export async function POST(req: Request) {
  try {
    const { article, userId } = await req.json();

    if (!article || !userId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        title: article.slice(0, 60),
      })
      .select()
      .single();

    if (threadError) {
      console.error("Thread insert error:", threadError);
      return NextResponse.json(
        { error: threadError.message },
        { status: 500 }
      );
    }

    const { error: userMessageError } = await supabase
      .from("messages")
      .insert({
        thread_id: thread.id,
        role: "user",
        content: article,
      });

    if (userMessageError) {
      console.error("User message insert error:", userMessageError);
      return NextResponse.json(
        { error: userMessageError.message },
        { status: 500 }
      );
    }

    const response = await openai.responses.parse({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content:
            "You are a political bias analysis engine. Return structured JSON only. Do not include conversational text.",
        },
        {
          role: "user",
          content: article,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "article_analysis",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              biasScore: { type: "number" },
              leaning: { type: "string" },
              summary: { type: "string" },
              framing: { type: "array", items: { type: "string" } },
              loadedLanguage: { type: "array", items: { type: "string" } },
              missingContext: { type: "array", items: { type: "string" } },
              overallAssessment: { type: "string" },
            },
            required: [
              "biasScore",
              "leaning",
              "summary",
              "framing",
              "loadedLanguage",
              "missingContext",
              "overallAssessment",
            ],
          },
        },
      },
    });

    const analysis = response.output_parsed as ArticleAnalysis | null;

    if (!analysis) {
      return NextResponse.json(
        { error: "OpenAI returned no analysis" },
        { status: 500 }
      );
    }

    const { error: assistantMessageError } = await supabase
      .from("messages")
      .insert({
        thread_id: thread.id,
        role: "assistant",
        content: analysis.summary,
        analysis_json: analysis,
      });

    if (assistantMessageError) {
      console.error("Assistant message insert error:", assistantMessageError);
      return NextResponse.json(
        { error: assistantMessageError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      threadId: thread.id,
      analysis,
    });
  } catch (err: unknown) {
    console.error("Unexpected server error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
