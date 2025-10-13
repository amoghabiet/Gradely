alter table public.user_roles enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_tests enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.submission_results enable row level security;
alter table public.notifications enable row level security;

-- Helpers:
-- Students: role = 'student'
-- Instructors: role in ('instructor','admin')
-- TAs: role in ('ta','instructor','admin')

-- user_roles
create policy "user can read own role" on public.user_roles
for select using (auth.uid() = user_id);
create policy "admin can manage roles" on public.user_roles
for all using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));

-- assignments
create policy "anyone can read assignments" on public.assignments
for select using (true);
create policy "instructor can insert assignments" on public.assignments
for insert with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('instructor','admin')));
create policy "instructor can update own assignments" on public.assignments
for update using (created_by = auth.uid())
with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role in ('instructor','admin')));

-- assignment_tests
create policy "read tests" on public.assignment_tests for select using (true);
create policy "instructor manage tests" on public.assignment_tests
for all using (exists (select 1 from public.assignments a where a.id = assignment_id and a.created_by = auth.uid()))
with check (exists (select 1 from public.assignments a where a.id = assignment_id and a.created_by = auth.uid()));

-- assignment_submissions
create policy "student read own submissions" on public.assignment_submissions
for select using (user_id = auth.uid() or exists (
  select 1 from public.assignments a
  join public.user_roles ur on ur.user_id = auth.uid() and ur.role in ('ta','instructor','admin')
  where a.id = assignment_id and (a.created_by = auth.uid() or ur.role in ('ta','instructor','admin'))
));
create policy "student insert own submission" on public.assignment_submissions
for insert with check (user_id = auth.uid());
create policy "grader update submission" on public.assignment_submissions
for update using (exists (
  select 1 from public.assignments a
  join public.user_roles ur on ur.user_id = auth.uid() and ur.role in ('ta','instructor','admin')
  where a.id = assignment_id and (a.created_by = auth.uid() or ur.role in ('ta','instructor','admin'))
));

-- submission_results
create policy "read related results" on public.submission_results
for select using (exists (
  select 1 from public.assignment_submissions s
  where s.id = submission_id and (s.user_id = auth.uid() or exists (
    select 1 from public.assignments a
    join public.user_roles ur on ur.user_id = auth.uid() and ur.role in ('ta','instructor','admin')
    where a.id = s.assignment_id and (a.created_by = auth.uid() or ur.role in ('ta','instructor','admin'))
  ))
));
create policy "grader manage results" on public.submission_results
for all using (exists (
  select 1 from public.assignment_submissions s
  join public.assignments a on a.id = s.assignment_id
  join public.user_roles ur on ur.user_id = auth.uid() and ur.role in ('ta','instructor','admin')
  where s.id = submission_id and (a.created_by = auth.uid() or ur.role in ('ta','instructor','admin'))
));

-- notifications
create policy "read own notifications" on public.notifications
for select using (user_id = auth.uid());
create policy "insert notifications for any user (system)" on public.notifications
for insert with check (true);
create policy "update own notifications" on public.notifications
for update using (user_id = auth.uid());
