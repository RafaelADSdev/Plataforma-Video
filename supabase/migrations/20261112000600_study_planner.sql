create table public.study_planner_days (
  course_id uuid not null references public.courses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  study_date date not null check (study_date between date '1000-01-01' and date '9999-12-31'),
  note text not null check (char_length(note) between 1 and 280 and note ~ '[^[:space:]]'),
  primary key (course_id, owner_id, study_date)
);

revoke all on table public.study_planner_days from public, anon, authenticated;
grant select, insert, update, delete on table public.study_planner_days to authenticated;

alter table public.study_planner_days enable row level security;

create policy study_planner_days_own
on public.study_planner_days for all
to authenticated
using (
  owner_id = (select auth.uid())
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('aluno', 'professor', 'admin')
);
