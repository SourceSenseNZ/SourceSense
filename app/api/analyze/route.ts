export const runtime = "nodejs";

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store usage in memory
const usageMap = new Map<
  string,
  { count: number; firstRequestTime: number }
>();

const DAILY_LIMIT = 3;
const ONE_DAY = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  try {
    const ip =
      req.headers.get("x-forwarded-for") ||
      "unknown";

    const now = Date.now();

    const userData = usageMap.get(ip);

    if (userData) {
      const timePassed = now - userData.firstRequestTime;

      if (timePassed > ONE_DAY) {
        // Reset after 24h
        usageMap.set(ip, {
          count: 1,
          firstRequestTime: now,
        });
      } else {
        if (userData.count >= DAILY_LIMIT) {
          return Response.json(
            { error: "Daily free limit reached (3 per day)." },
            { status: 429 }
          );
        }

        usageMap.set(ip, {
          count: userData.count + 1,
          firstRequestTime: userData.firstRequestTime,
        });
      }
    } else {
      usageMap.set(ip, {
        count: 1,
        firstRequestTime: now,
      });
    }

    const { article } = await req.json();

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
          content:
            "You are a neutral media analysis assistant.",
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
