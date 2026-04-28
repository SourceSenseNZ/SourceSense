import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { article } = await req.json();

    if (!article) {
      return Response.json({ error: "No article provided" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
You are an unbiased media analysis assistant.
Analyze news articles for:
1. Political leaning (if detectable)
2. Emotional or loaded language
3. Framing techniques
4. Missing perspectives
Use structured headings.
Do not determine truth or accuse misinformation.
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
    console.error(error);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}