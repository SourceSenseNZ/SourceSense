import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "mock-key-for-build",
});

export const ANALYSIS_SYSTEM_PROMPT = `You are SourceSense, an expert media bias and editorial analysis engine.

Your job is to analyze news articles for:
- Political leaning and bias intensity (0=neutral, 100=extremely biased)
- Framing techniques, loaded language, missing context
- Credibility and sourcing gaps
- Headline vs body accuracy

Rules:
- Be objective, specific, and evidence-based. Cite exact phrases from the article.
- Do NOT be generic. Every analysis must be unique to the provided article.
- Lean categories: Far Left, Left, Centre-left, Centre, Centre-right, Right, Far Right.
- Bias score: 0-20 very balanced, 21-40 slight lean, 41-60 moderate bias, 61-80 strong bias, 81-100 extreme
- For framing: identify rhetorical techniques like "emotional appeal", "false dichotomy", "appeal to authority", "cherry-picking", "ad hominem", "fear-mongering", "bandwagon", etc.
- For loadedLanguage: find emotionally charged words/phrases.
- Return ONLY valid JSON matching the schema. No markdown, no extra text.
- Make summary neutral, 3-4 sentences, covering what happened without taking sides.`;

export const CHAT_SYSTEM_PROMPT = `You are SourceSense, a media literacy assistant continuing a conversation about a previously analyzed article.

You have access to the full thread history including the structured bias analysis.

Guidelines:
- Be helpful, concise, and neutral.
- If user asks for deeper bias analysis, refer back to specific framing techniques and loaded language you found.
- If user asks for fact-checking, suggest sources to check and what context is missing.
- If user asks for a different perspective, provide balanced counterpoints.
- Do NOT hallucinate facts not in the article. Be clear when you are speculating.
- Keep tone analytical, not political. You are Centre - you critique bias on all sides.`;

// Structured output JSON schema for OpenAI Responses API
export const ANALYSIS_JSON_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    biasScore: {
      type: "number",
      description: "0-100 bias intensity, 0=neutral, 100=extreme bias",
    },
    leaning: {
      type: "string",
      enum: [
        "Far Left",
        "Left",
        "Centre-left",
        "Centre",
        "Centre-right",
        "Right",
        "Far Right",
      ],
    },
    confidence: {
      type: "number",
      description: "0-100 confidence in this analysis",
    },
    summary: {
      type: "string",
      description: "Neutral 3-4 sentence summary of the article",
    },
    headlineAnalysis: {
      type: "string",
      description: "Analysis of whether headline matches body, sensationalized etc",
    },
    framing: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          technique: { type: "string" },
          example: { type: "string", description: "Direct quote or paraphrase from article" },
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
    missingContext: {
      type: "array",
      items: { type: "string" },
      description: "Important context, data, or perspectives omitted",
    },
    sourcesToCheck: {
      type: "array",
      items: { type: "string" },
      description: "Claims that need verification, sources to check",
    },
    credibilityScore: {
      type: "number",
      description: "0-100 how credible / well-sourced the article is",
    },
    overallAssessment: {
      type: "string",
      description: "2-3 sentence overall editorial assessment",
    },
    keyTakeaways: {
      type: "array",
      items: { type: "string" },
      description: "3-5 bullet takeaways for reader",
    },
  },
  required: [
    "biasScore",
    "leaning",
    "confidence",
    "summary",
    "headlineAnalysis",
    "framing",
    "loadedLanguage",
    "missingContext",
    "sourcesToCheck",
    "credibilityScore",
    "overallAssessment",
    "keyTakeaways",
  ] as const,
};

export function getMockAnalysis(article: string) {
  // Fallback mock when OPENAI_API_KEY missing - still structured but clearly mock
  const isPolitical = /trump|biden|government|election|policy/i.test(article);
  return {
    biasScore: isPolitical ? 62 : 35,
    leaning: isPolitical ? "Centre-right" : "Centre",
    confidence: 72,
    summary:
      "This is a mock analysis (OPENAI_API_KEY not configured). " +
      article.slice(0, 180) +
      "... The article appears to discuss a current event with some editorial framing.",
    headlineAnalysis:
      "Headline appears factual but mock detection suggests checking if it matches body tone.",
    framing: [
      {
        technique: "Selective emphasis",
        example: article.slice(0, 60),
        explanation:
          "The opening emphasizes one aspect of the story over others, guiding reader interpretation.",
      },
    ],
    loadedLanguage: [
      {
        phrase: "Example loaded term",
        context: "Found in opening paragraph",
        impact: "Adds emotional weight",
        severity: "medium" as const,
      },
    ],
    missingContext: [
      "Historical context not provided",
      "Opposing viewpoint data missing",
      "Source methodology unclear",
    ],
    sourcesToCheck: [
      "Primary source documents",
      "Independent reporting on same event",
      "Data cited in article",
    ],
    credibilityScore: 68,
    overallAssessment:
      "Mock analysis: Article shows moderate framing. Configure OPENAI_API_KEY for real analysis. Structure is valid but content is placeholder.",
    keyTakeaways: [
      "Mock mode active - add OPENAI_API_KEY",
      "Structure demonstrates UI capability",
      "Real analysis requires OpenAI integration",
    ],
  };
}
