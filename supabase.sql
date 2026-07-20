-- SourceSense Production Schema
-- Run these in Supabase SQL Editor in order

-- 1. Fix threads table - add title column (fixes 500 error you saw)
alter table threads add column if not exists title text;

-- 2. Add structured JSON storage to messages
alter table messages add column if not exists analysis_json jsonb;

-- Optional: add created index for performance
create index if not exists messages_thread_id_created_at_idx on messages(thread_id, created_at);
create index if not exists threads_user_id_created_at_idx on threads(user_id, created_at desc);
create index if not exists messages_analysis_json_idx on messages using gin (analysis_json);

-- 3. Re-enable RLS safely (after confirming backend uses SERVICE ROLE KEY)
-- Backend API routes MUST use SUPABASE_SERVICE_ROLE_KEY, not anon key!
-- This is critical: service role bypasses RLS, so your API can still write while frontend is restricted.

-- Enable RLS
alter table threads enable row level security;
alter table messages enable row level security;

-- Drop existing policies if any (clean start)
drop policy if exists "Users can view own threads" on threads;
drop policy if exists "Users can insert own threads" on threads;
drop policy if exists "Users can update own threads" on threads;
drop policy if exists "Users can delete own threads" on threads;

drop policy if exists "Users can view messages in own threads" on messages;
drop policy if exists "Users can insert messages in own threads" on messages;
drop policy if exists "Users can delete messages in own threads" on messages;

-- Threads policies: user can only access threads where user_id = auth.uid()
create policy "Users can view own threads"
  on threads for select
  using (auth.uid() = user_id);

create policy "Users can insert own threads"
  on threads for insert
  with check (auth.uid() = user_id);

create policy "Users can update own threads"
  on threads for update
  using (auth.uid() = user_id);

create policy "Users can delete own threads"
  on threads for delete
  using (auth.uid() = user_id);

-- Messages policies: user can access messages where thread belongs to them
-- This uses a subquery to check ownership via threads table
create policy "Users can view messages in own threads"
  on messages for select
  using (
    exists (
      select 1 from threads
      where threads.id = messages.thread_id
      and threads.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in own threads"
  on messages for insert
  with check (
    exists (
      select 1 from threads
      where threads.id = messages.thread_id
      and threads.user_id = auth.uid()
    )
  );

create policy "Users can delete messages in own threads"
  on messages for delete
  using (
    exists (
      select 1 from threads
      where threads.id = messages.thread_id
      and threads.user_id = auth.uid()
    )
  );

-- Note: For backend API routes using SERVICE_ROLE_KEY, RLS is automatically bypassed.
-- So your /api/analyze and /api/chat will still work even with RLS enabled.

-- Optional: Verify schema
-- select * from threads limit 1;
-- select * from messages limit 1;
