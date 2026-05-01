export const runtime = "nodejs";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const requestCounts = new Map<string, number>();

export async function POST(req: Request) {
  try {
    const { article } = await req.json();

    const ip = req.headers.get("x-forwarded-for") || "unknown";

    const count = requestCounts.get(ip) || 0;

    if (count >= 5) {
      return Response.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    requestCounts.set(ip, count + 1);

    if (!article || article.length > 5000) {
      return Response.json(
        { error: "Article too long or missing." },
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

  } catch (error: unknown) {
    console.error("OpenAI error:", error);

    return Response.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}
