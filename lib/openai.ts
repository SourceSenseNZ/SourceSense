import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "mock-key-for-build",
  timeout: 20000, // 20s timeout for hobby plan safety
  maxRetries: 1,
});

export const ANALYSIS_SYSTEM_PROMPT = `You are SourceSense, an expert media bias and editorial analysis engine.

Your job is to analyze news articles for political leaning, bias intensity, framing, loaded language, missing context.

Rules:
- Be objective, specific, evidence-based. Cite exact phrases.
- Do NOT be generic. Every analysis must be unique to article.
- Lean: Far Left, Left, Centre-left, Centre, Centre-right, Right, Far Right.
- Bias 0-20 very balanced, 21-40 slight, 41-60 moderate, 61-80 strong, 81-100 extreme
- Framing: detect techniques like emotional appeal, false dichotomy, cherry-picking, fear-mongering etc.
- Return ONLY valid JSON matching schema. No markdown.

Keep summary neutral, 3-4 sentences. Be fast and concise.`;

export const CHAT_SYSTEM_PROMPT = `You are SourceSense, a media literacy assistant continuing conversation about previously analyzed article. Be helpful, concise, neutral. Refer to specific framing/loaded language found. Don't hallucinate.`;

// Primary model - fast and cheap, widely available. Fallback to gpt-4o-mini if 4.1 not available
export const PRIMARY_MODEL = "gpt-4o-mini";
export const FALLBACK_MODEL = "gpt-4.1-mini";

export const ANALYSIS_JSON_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    biasScore: { type: "number", description: "0-100 bias intensity" },
    leaning: {
      type: "string",
      enum: ["Far Left", "Left", "Centre-left", "Centre", "Centre-right", "Right", "Far Right"],
    },
    confidence: { type: "number" },
    summary: { type: "string" },
    headlineAnalysis: { type: "string" },
    framing: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          technique: { type: "string" },
          example: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["technique", "example", "explanation"],
      },
    },
    loadedLanguage: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          phrase: { type: "string" },
          context: { type: "string" },
          impact: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["phrase", "context", "impact", "severity"],
      },
    },
    missingContext: { type: "array", items: { type: "string" } },
    sourcesToCheck: { type: "array", items: { type: "string" } },
    credibilityScore: { type: "number" },
    overallAssessment: { type: "string" },
    keyTakeaways: { type: "array", items: { type: "string" } },
  },
  required: [
    "biasScore", "leaning", "confidence", "summary", "headlineAnalysis",
    "framing", "loadedLanguage", "missingContext", "sourcesToCheck",
    "credibilityScore", "overallAssessment", "keyTakeaways",
  ] as const,
};

export function getMockAnalysis(article: string) {
  const isPolitical = /trump|biden|government|election|policy/i.test(article);
  return {
    biasScore: isPolitical ? 62 : 35,
    leaning: isPolitical ? "Centre-right" : "Centre",
    confidence: 72,
    summary: "This is a mock analysis (OPENAI_API_KEY not configured or timed out). " + article.slice(0, 180) + "...",
    headlineAnalysis: "Headline appears factual but check if matches body tone.",
    framing: [
      {
        technique: "Selective emphasis",
        example: article.slice(0, 60),
        explanation: "Opening emphasizes one aspect over others.",
      },
    ],
    loadedLanguage: [
      {
        phrase: "Example loaded term",
        context: "Opening paragraph",
        impact: "Adds emotional weight",
        severity: "medium" as const,
      },
    ],
    missingContext: ["Historical context not provided", "Opposing viewpoint missing", "Methodology unclear"],
    sourcesToCheck: ["Primary source documents", "Independent reporting", "Data cited"],
    credibilityScore: 68,
    overallAssessment: "Mock analysis: moderate framing. Add valid OPENAI_API_KEY for real analysis.",
    keyTakeaways: ["Mock mode if key missing or timed out", "Structure shows UI", "Real analysis needs OpenAI"],
  };
}

// Helper with timeout to prevent Vercel 10s hang - returns promise that rejects after ms
export function withTimeout<T>(promise: Promise<T>, ms: number, message = "Timeout"): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}
