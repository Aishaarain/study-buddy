-- ============================================
-- StudyAI Supabase Schema (with pgvector RAG)
-- ============================================

-- 1. Enable required extensions
create extension if not exists vector;

-- ============================================
-- 2. PROFILES (extends Supabase auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  credits integer not null default 50,        -- monetization tier system
  plan text not null default 'free',          -- free | pro | premium
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- 3. DOCUMENTS (uploaded notes/PDFs)
-- ============================================
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_path text not null,         -- path in Supabase Storage
  file_type text not null,         -- pdf | docx | txt
  file_size_bytes integer,
  status text not null default 'processing', -- processing | ready | failed
  page_count integer,
  created_at timestamptz not null default now()
);

create index documents_user_id_idx on public.documents(user_id);

-- ============================================
-- 4. DOCUMENT CHUNKS (text + embeddings for RAG)
-- ============================================
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536),          -- text-embedding-3-small dimension
  created_at timestamptz not null default now()
);

create index document_chunks_document_id_idx on public.document_chunks(document_id);

-- HNSW index for fast similarity search
create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw (embedding vector_cosine_ops);

-- ============================================
-- 5. CHATS + MESSAGES (Ask AI feature)
-- ============================================
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null default 'New Chat',
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_chat_id_idx on public.chat_messages(chat_id);

-- ============================================
-- 6. SUMMARIES
-- ============================================
create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

-- ============================================
-- 7. QUIZZES
-- ============================================
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  difficulty text not null default 'medium', -- easy | medium | hard
  created_at timestamptz not null default now()
);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_type text not null check (question_type in ('mcq', 'short', 'conceptual')),
  question text not null,
  options jsonb,                    -- ["A...", "B...", "C...", "D..."] for MCQ
  correct_answer text not null,
  explanation text,
  order_index integer not null default 0
);

create index quiz_questions_quiz_id_idx on public.quiz_questions(quiz_id);

-- ============================================
-- 8. FLASHCARDS
-- ============================================
create table public.flashcard_sets (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.flashcard_sets(id) on delete cascade,
  front text not null,
  back text not null,
  order_index integer not null default 0
);

create index flashcards_set_id_idx on public.flashcards(set_id);

-- ============================================
-- 9. REVISION PLANNER
-- ============================================
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  exam_date date,
  status text not null default 'active', -- active | completed | archived
  created_at timestamptz not null default now()
);

create table public.study_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  title text not null,
  description text,
  scheduled_date date not null,
  is_completed boolean not null default false,
  order_index integer not null default 0
);

create index study_plan_tasks_plan_id_idx on public.study_plan_tasks(plan_id);

-- ============================================
-- 10. CREDIT USAGE LOG (for monetization tiers)
-- ============================================
create table public.credit_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,             -- upload | chat | quiz | flashcards | planner | summary
  credits_used integer not null default 1,
  created_at timestamptz not null default now()
);

-- ============================================
-- 11. ROW LEVEL SECURITY
-- ============================================
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;
alter table public.summaries enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.flashcard_sets enable row level security;
alter table public.flashcards enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_tasks enable row level security;
alter table public.credit_usage enable row level security;

-- PROFILES: users can read/update only their own row
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- DOCUMENTS: full CRUD on own rows
create policy "Users manage own documents" on public.documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- DOCUMENT_CHUNKS: read/write own rows only (Edge Functions use service role and bypass this anyway)
create policy "Users manage own chunks" on public.document_chunks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CHATS
create policy "Users manage own chats" on public.chats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CHAT_MESSAGES
create policy "Users manage own chat messages" on public.chat_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- SUMMARIES
create policy "Users manage own summaries" on public.summaries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- QUIZZES
create policy "Users manage own quizzes" on public.quizzes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- QUIZ_QUESTIONS (scoped via parent quiz ownership)
create policy "Users manage own quiz questions" on public.quiz_questions
  for all using (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.quizzes q where q.id = quiz_id and q.user_id = auth.uid())
  );

-- FLASHCARD_SETS
create policy "Users manage own flashcard sets" on public.flashcard_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- FLASHCARDS (scoped via parent set ownership)
create policy "Users manage own flashcards" on public.flashcards
  for all using (
    exists (select 1 from public.flashcard_sets s where s.id = set_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.flashcard_sets s where s.id = set_id and s.user_id = auth.uid())
  );

-- STUDY_PLANS
create policy "Users manage own study plans" on public.study_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- STUDY_PLAN_TASKS (scoped via parent plan ownership)
create policy "Users manage own plan tasks" on public.study_plan_tasks
  for all using (
    exists (select 1 from public.study_plans p where p.id = plan_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.study_plans p where p.id = plan_id and p.user_id = auth.uid())
  );

-- CREDIT_USAGE: read-only for users, writes happen via Edge Functions (service role)
create policy "Users view own credit usage" on public.credit_usage
  for select using (auth.uid() = user_id);

-- ============================================
-- 12. RPC: vector similarity search for RAG
-- ============================================
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_document_id uuid,
  match_user_id uuid,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  chunk_index int,
  similarity float
)
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  select
    document_chunks.id,
    document_chunks.content,
    document_chunks.chunk_index,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.document_id = match_document_id
    and document_chunks.user_id = match_user_id
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================
-- 13. STORAGE BUCKET for uploaded documents
-- ============================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "Users upload own documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users read own documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);