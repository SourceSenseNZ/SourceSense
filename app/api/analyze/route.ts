export const runtime = "nodejs";
export const maxDuration = 10;
import { supabaseAdmin, getUserFromRequest } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { article, userId: clientUserId, title: clientTitle } = await req.json();
    if (!article || article.trim().length < 20) return NextResponse.json({ error: "Too short" }, { status: 400 });
    let userId = await getUserFromRequest(req);
    if (!userId && clientUserId) userId = clientUserId;
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = supabaseAdmin();
    const title = (clientTitle?.trim() || article.slice(0, 60)).slice(0,80);
    const { data: thread, error: tErr } = await supabase.from("threads").insert({ user_id: userId, title }).select().single();
    if (tErr || !thread) return NextResponse.json({ error: tErr?.message }, { status: 500 });

    await supabase.from("messages").insert({ thread_id: thread.id, role: "user", content: article.slice(0,3000) });

    const key = process.env.OPENAI_API_KEY || "";
    if (!key.startsWith("sk-")) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: key, timeout: 9000, maxRetries: 0 });
      const trimmed = article.slice(0, 2500);
      const prompt = `You are SourceSense bias analyzer. Return ONLY valid JSON with keys: biasScore (0-100 number), leaning (one of Far Left, Left, Centre-left, Centre, Centre-right, Right, Far Right), confidence (0-100), summary (3 sentence neutral), headlineAnalysis (string), framing (array of {technique, example, explanation}), loadedLanguage (array of {phrase, context, impact, severity low|medium|high}), missingContext (array string), sourcesToCheck (array string), credibilityScore (0-100), overallAssessment (string), keyTakeaways (array string). Be specific with quotes from article. Article: ${trimmed}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1200,
      });

      const raw = completion.choices[0]?.message?.content || "";
      const jsonStr = raw.match(/\{[\s\S]*\}/)?.[0] || raw;
      const parsed = JSON.parse(jsonStr);

      const analysis = {
        biasScore: Number(parsed.biasScore) || 50,
        leaning: parsed.leaning || "Centre",
        confidence: parsed.confidence || 70,
        summary: parsed.summary || "Analysis complete",
        headlineAnalysis: parsed.headlineAnalysis || "",
        framing: parsed.framing || [],
        loadedLanguage: parsed.loadedLanguage || [],
        missingContext: parsed.missingContext || [],
        sourcesToCheck: parsed.sourcesToCheck || [],
        credibilityScore: parsed.credibilityScore || 65,
        overallAssessment: parsed.overallAssessment || "",
        keyTakeaways: parsed.keyTakeaways || [],
      };

      await supabase.from("messages").insert({ thread_id: thread.id, role: "assistant", content: analysis.summary, analysis_json: analysis });

      return NextResponse.json({ threadId: thread.id, analysis });

    } catch (aiErr: any) {
      console.error("OpenAI fail:", aiErr?.status, aiErr?.message);
      // Return mock BUT mark as real failure so you see error, not spinner
      return NextResponse.json({ error: `OpenAI ${aiErr?.status || ""} ${aiErr?.code || ""}: ${aiErr?.message}. Check platform.openai.com -> Usage and Billing. Key ${key.slice(0,12)}...` }, { status: 502 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
