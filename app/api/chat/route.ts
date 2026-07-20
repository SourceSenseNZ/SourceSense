export const runtime = "nodejs";

import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { openai, CHAT_SYSTEM_PROMPT, getMockAnalysis } from "@/lib/openai";
import { NextResponse } from "next/server";
import type { EasyInputMessage, ResponseInput } from "openai/resources/responses/responses";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { threadId, message, userId: clientUserId } = body;

    if (!threadId || !message) {
      return NextResponse.json({ error: "Missing threadId or message" }, { status: 400 });
    }

    if (typeof message !== "string" || message.trim().length < 1) {
      return NextResponse.json({ error: "Message empty" }, { status: 400 });
    }

    let authUserId = await getUserFromRequest(req);
    if (!authUserId && clientUserId) authUserId = clientUserId;

    // We'll still require thread ownership check via DB lookup when we have authUserId
    const supabase = supabaseAdmin();

    // Optional ownership check
    if (authUserId) {
      const { data: thread } = await supabase
        .from("threads")
        .select("id, user_id")
        .eq("id", threadId)
        .single();
      
      if (thread && thread.user_id !== authUserId) {
        return NextResponse.json({ error: "Forbidden - not your thread" }, { status: 403 });
      }
    }

    // Get previous messages including analysis_json if present
    const { data: previousMessages, error: previousError } = await supabase
      .from("messages")
      .select("role, content, analysis_json, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (previousError) {
      console.error("Previous messages fetch error:", previousError);
      return NextResponse.json({ error: previousError.message }, { status: 500 });
    }

    if (!previousMessages || previousMessages.length === 0) {
      return NextResponse.json({ error: "Thread not found or empty" }, { status: 404 });
    }

    // Build context for OpenAI - include structured analysis as context if present
    const priorMessages: EasyInputMessage[] = previousMessages.map((m: any) => {
      let content = m.content || "";
      
      // If assistant message has analysis_json, inject summary of it for context
      if (m.role === "assistant" && m.analysis_json) {
        const aj = m.analysis_json;
        const structuredContext = `\n[STRUCTURED_ANALYSIS: biasScore=${aj.biasScore}, leaning=${aj.leaning}, credibility=${aj.credibilityScore}, summary=${aj.summary?.slice(0, 300)}]`;
        content = content + structuredContext;
      }

      return {
        role: m.role === "assistant" ? "assistant" : "user",
        content,
      };
    });

    const openaiMessages: ResponseInput = [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      ...priorMessages,
      { role: "user", content: message.trim() },
    ];

    let assistantReply: string;

    if (!process.env.OPENAI_API_KEY) {
      // Mock chat reply
      assistantReply = `This is a mock chat reply because OPENAI_API_KEY is not set.\n\nYou asked: "${message.slice(0, 200)}"\n\nIn the real version, I would reference the original article analysis and answer in context. For example, I could elaborate on the bias score, explain framing techniques found, or suggest additional sources to check.\n\nConfigure OPENAI_API_KEY in your environment to enable real chat.`;
    } else {
      try {
        const response = await openai.responses.create({
          model: "gpt-4.1-mini",
          input: openaiMessages,
          // Keep chat as text, not structured
        });
        assistantReply = response.output_text || "Sorry, I couldn't generate a reply.";
      } catch (err: unknown) {
        console.error("OpenAI chat error:", err);
        const msg = err instanceof Error ? err.message : "OpenAI error";
        return NextResponse.json({ error: `Chat failed: ${msg}` }, { status: 502 });
      }
    }

    // Save user message
    const { error: userInsertError } = await supabase.from("messages").insert({
      thread_id: threadId,
      role: "user",
      content: message.trim(),
    });

    if (userInsertError) {
      console.error("User chat message insert error:", userInsertError);
      return NextResponse.json({ error: userInsertError.message }, { status: 500 });
    }

    // Save assistant reply
    const { data: assistantMsg, error: assistantInsertError } = await supabase
      .from("messages")
      .insert({
        thread_id: threadId,
        role: "assistant",
        content: assistantReply,
      })
      .select()
      .single();

    if (assistantInsertError) {
      console.error("Assistant chat insert error:", assistantInsertError);
      return NextResponse.json({ error: assistantInsertError.message }, { status: 500 });
    }

    return NextResponse.json({ reply: assistantReply, message: assistantMsg });
  } catch (err: unknown) {
    console.error("Unexpected error in /api/chat:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error" },
      { status: 500 }
    );
  }
}
