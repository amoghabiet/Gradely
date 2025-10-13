-- Use Supabase auth.users for user identities; rely on RLS via auth.uid()

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student','instructor','ta','admin')),
  created_at timestamp with time zone default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  language text not null default 'typescript',
  due_at timestamp with time zone,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table if not exists public.assignment_tests (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  name text not null,
  -- For MVP, store simple JS snippets that export a function run({ userCode }): { pass: boolean, message?: string }
  test_code text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  language text not null default 'typescript',
  status text not null default 'pending' check (status in ('pending','graded','error')),
  score numeric(5,2),
  feedback jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique (assignment_id, user_id)
);

create table if not exists public.submission_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions(id) on delete cascade,
  test_id uuid not null references public.assignment_tests(id) on delete cascade,
  pass boolean not null,
  message text,
  created_at timestamp with time zone default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'deadline','graded','reminder'
  payload jsonb not null,
  read boolean not null default false,
  created_at timestamp with time zone default now()
);

create view public.assignment_stats as
select
  a.id as assignment_id,
  count(s.id) as submission_count,
  avg(s.score) as avg_score
from public.assignments a
left join public.assignment_submissions s on s.assignment_id = a.id and s.status = 'graded'
group by a.id;
