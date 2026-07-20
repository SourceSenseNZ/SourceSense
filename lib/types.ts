export type Leaning =
  | "Far Left"
  | "Left"
  | "Centre-left"
  | "Centre"
  | "Centre-right"
  | "Right"
  | "Far Right";

export type FramingItem = {
  technique: string;
  example: string;
  explanation: string;
};

export type LoadedLanguageItem = {
  phrase: string;
  context: string;
  impact: string;
  severity: "low" | "medium" | "high";
};

export type ArticleAnalysis = {
  biasScore: number; // 0-100, 0 = neutral / balanced, 100 = highly biased
  leaning: Leaning;
  confidence: number; // 0-100 how confident the model is
  summary: string; // 3-4 sentence neutral summary
  headlineAnalysis: string; // analysis of headline vs body
  framing: FramingItem[];
  loadedLanguage: LoadedLanguageItem[];
  missingContext: string[];
  sourcesToCheck: string[];
  credibilityScore: number; // 0-100
  overallAssessment: string;
  keyTakeaways: string[];
};

export type Thread = {
  id: string;
  created_at: string;
  user_id: string;
  title: string | null;
};

export type Message = {
  id: string;
  created_at: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  analysis_json?: ArticleAnalysis | null;
};
