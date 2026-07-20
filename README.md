# SourceSense - Real AI Media Bias Analysis

Next.js + Supabase + OpenAI gpt-4.1-mini structured outputs

This is the upgraded v2 implementation moving from mock MVP to real AI platform.

## What Works (Current)

- Auth (Supabase)
- Threads table (with title column fix)
- Messages table with analysis_json jsonb
- Analyze route with real OpenAI Responses API
- Chat route with thread history
- Sidebar with thread persistence
- Deployment on Vercel
- RLS-ready backend using SERVICE ROLE KEY

## Architecture Fix Applied

Original bug: 500 because threads table missing title column

```sql
alter table threads add column title text;
```

After this, analyze flow works.

## Database Schema

### threads
- id uuid pk
- created_at timestamptz
- user_id uuid (auth.users)
- title text

### messages
- id uuid pk
- created_at timestamptz
- thread_id uuid fk -> threads
- role text ('user' | 'assistant')
- content text
- analysis_json jsonb (new - stores structured analysis)

Run `supabase.sql` for full migration + RLS policies.

## Backend Must Use Service Role

Correct:
```ts
createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

NOT:
```
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

We support both SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL envs, but service key is mandatory for API routes.

See `lib/supabaseServer.ts`.

## OpenAI Integration - Real (not mock)

Uses OpenAI Responses API with gpt-4.1-mini + strict JSON schema.

Model: `gpt-4.1-mini`
API: `openai.responses.parse` with `text.format: json_schema`

Schema includes:
- biasScore 0-100
- leaning: Far Left ... Far Right
- confidence, credibilityScore
- summary, headlineAnalysis, overallAssessment
- framing[]: {technique, example, explanation}
- loadedLanguage[]: {phrase, context, impact, severity}
- missingContext[], sourcesToCheck[], keyTakeaways[]

Prompt makes outputs unique, not generic chatbot text.

Fallback: if OPENAI_API_KEY missing, uses mock analysis so app still works.

## API Routes

### POST /api/analyze
- Creates thread (title auto-generated)
- Saves user article as message
- Calls OpenAI for structured analysis
- Stores assistant message with analysis_json
- Returns {threadId, analysis, message}

Body: {article: string, userId?: string, title?, url?}
Auth: Bearer token preferred, userId fallback

### POST /api/chat
- Multi-turn conversation within thread
- Loads previous messages + analysis_json context
- Calls OpenAI with full history
- Saves user + assistant messages
- Returns {reply, message}

Body: {threadId, message, userId?}

### GET /api/threads?userId=
- Lists threads for user (RLS-safe via service role)

### GET /api/threads/[id]?userId=
- Gets thread + messages (includes analysis_json)

### DELETE /api/threads?id=&userId=
- Deletes thread and messages with ownership check

## Frontend - New in v2

Rewritten `app/page.tsx`:

- Theme aware (light/dark/auto)
- Sidebar with thread list, count, delete
- Intro hero with feature cards
- Article input with validation
- AnalysisCard component with:
  - Bias gauge SVG 0-100 color-coded
  - Leaning badge colored
  - Credibility + confidence
  - Summary + headline analysis + overall
  - Framing techniques cards with quotes
  - Loaded language with severity badges
  - Missing context list
  - Sources to check + key takeaways
- Follow-up chat input when thread active (Enter to send)
- Direct Supabase query with API fallback for compatibility
- Auth check + logout

Components:
- `components/AnalysisCard.tsx` - main rendering for structured JSON

## Environment Variables

See `.env.example`

Required:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_URL (or fallback to NEXT_PUBLIC_)
- OPENAI_API_KEY

Vercel: add all in dashboard.

## RLS Status

During debugging RLS was disabled. To re-enable safely:

1. Confirm backend uses SERVICE ROLE KEY (it does in v2)
2. Run policies from `supabase.sql`
3. This file enables RLS + creates policies: users only access own threads/messages
4. Backend still works because service role bypasses RLS
5. Frontend direct queries will then respect RLS; API routes remain working

## Local Dev

```bash
npm install
npm run dev
```

Add .env.local from .env.example

## Deployment

Vercel auto-deploys from GitHub. Set env vars in Vercel dashboard.

## Upgrade Notes from MVP

Removed FORCE_MOCK - now uses real OpenAI with mock fallback only if key missing
Added analysis_json jsonb column
Added rich structured schema (objects not just strings)
Added AnalysisCard UI so output is unique, not generic chat bubbles
Added multi-message chat persistence
Added API routes for thread management that are RLS-safe
Kept backward compatibility with userId body param while adding Bearer auth
