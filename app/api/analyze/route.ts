export const runtime = "nodejs";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { article } = await req.json();

    if (!article) {
      return Response.json(
        { error: "No article provided" },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a neutral media analysis assistant.",
        },
        {
          role: "user",
          content: article,
        },
      ],
    });

    return Response.json({
      result: response.choices[0].message.content,
    });

  } catch (error: any) {
    console.error("OpenAI error:", error);

    return Response.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
