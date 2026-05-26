export const runtime = "nodejs";

import { openai } from "@/lib/openai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type {
  EasyInputMessage,
  ResponseInput,
} from "openai/resources/responses/responses";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { threadId, message } = await req.json();

    if (!threadId || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const { data: previousMessages, error: previousMessagesError } =
      await supabase
        .from("messages")
        .select("role, content")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

    if (previousMessagesError) {
      console.error("Previous messages query error:", previousMessagesError);
      return NextResponse.json(
        { error: previousMessagesError.message },
        { status: 500 }
      );
    }

    const priorMessages: EasyInputMessage[] = (previousMessages ?? []).map(
      (m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })
    );

    const openaiMessages: ResponseInput = [
      {
        role: "system",
        content: "You are continuing a political bias discussion.",
      },
      ...priorMessages,
      {
        role: "user",
        content: message,
      },
    ];

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: openaiMessages,
    });

    const assistantReply = response.output_text;

    const { error: userMessageError } = await supabase.from("messages").insert({
      thread_id: threadId,
      role: "user",
      content: message,
    });

    if (userMessageError) {
      console.error("User message insert error:", userMessageError);
      return NextResponse.json(
        { error: userMessageError.message },
        { status: 500 }
      );
    }

    const { error: assistantMessageError } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        role: "assistant",
        content: assistantReply,
      });

    if (assistantMessageError) {
      console.error("Assistant message insert error:", assistantMessageError);
      return NextResponse.json(
        { error: assistantMessageError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ reply: assistantReply });
  } catch (err: unknown) {
    console.error("Unexpected server error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Unexpected server error",
      },
      { status: 500 }
    );
  }
}
