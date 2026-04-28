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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are a politically neutral media analysis assistant.

Analyze the article for:
1. Political leaning (if detectable)
2. Emotionally loaded language
3. Framing techniques
4. Missing perspectives

Do not judge truthfulness.
Do not take political positions.
Use structured headings.
Remain neutral and analytical.
          `,
        },
        {
          role: "user",
          content: article,
        },
      ],
    });

    return Response.json({
      result: completion.choices[0].message.content,
    });

  } catch (error) {
    console.error("API Error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
