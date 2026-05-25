export const runtime = "nodejs";

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FORCE_MOCK = true;

export async function POST(req: Request) {
  try {
    const { article, userId } = await req.json();

    if (!article || !userId) {
      console.error("Missing article or userId");
      return NextResponse.json(
        { error: "Missing article or userId" },
        { status: 400 }
      );
    }

    console.log("Creating thread...");

    const { data: thread, error: threadError } = await supabase
      .from("threads")
      .insert({
        user_id: userId,
        title: article.split(".")[0].slice(0, 80),
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

    console.log("Thread created:", thread.id);

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

    const mockResponse = FORCE_MOCK
      ? "This article demonstrates moderate framing bias toward economic nationalism."
      : "OpenAI disabled";

    const { error: assistantMessageError } = await supabase
      .from("messages")
      .insert({
        thread_id: thread.id,
        role: "assistant",
        content: mockResponse,
      });

    if (assistantMessageError) {
      console.error("Assistant message insert error:", assistantMessageError);
      return NextResponse.json(
        { error: assistantMessageError.message },
        { status: 500 }
      );
    }

    console.log("Analyze flow complete.");

    return NextResponse.json({
      threadId: thread.id,
      result: mockResponse,
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
