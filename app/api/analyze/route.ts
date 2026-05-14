export const runtime = "nodejs";

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { article, userId } = await req.json();

    if (!article || !userId) {
      return Response.json(
        { error: "Missing data" },
        { status: 400 }
      );
    }

    // Create new thread
    const { data: threadData, error: threadError } =
      await supabase
        .from("threads")
        .insert({ user_id: userId })
        .select()
        .single();

    if (threadError) throw threadError;

    const threadId = threadData.id;

    // Save user message
    await supabase.from("messages").insert({
      thread_id: threadId,
      role: "user",
      content: article,
    });

    let aiResponse: string;

    if (!process.env.OPENAI_API_KEY) {
      // Mock response for development
      aiResponse = `
SUMMARY:
This article discusses political developments and public reaction.

POTENTIAL BIAS:
The language appears moderately framed with selective emphasis.

LANGUAGE ANALYSIS:
Some emotionally loaded phrases are used to influence perception.

FRAMING:
The article emphasizes criticism while minimizing counterarguments.

MISSING CONTEXT:
Additional perspectives or statistical context could improve neutrality.
`;
    } else {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a neutral media analysis assistant." },
          { role: "user", content: article },
        ],
      });

      aiResponse = completion.choices[0].message.content!;
    }

    // Save AI response
    await supabase.from("messages").insert({
      thread_id: threadId,
      role: "assistant",
      content: aiResponse,
    });

    return Response.json({
      threadId,
      result: aiResponse,
    });

  } catch (error: unknown) {
    console.error(error);
    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
