create table public.study_routine_days (
  course_id uuid not null references public.courses(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  week_number smallint not null check (week_number between 1 and 4),
  weekday smallint not null check (weekday between 1 and 7),
  note text not null check (char_length(note) between 1 and 280 and note ~ '[^[:space:]]'),
  primary key (course_id, owner_id, week_number, weekday)
);

revoke all on table public.study_routine_days from public, anon, authenticated;
grant select, insert, update, delete on table public.study_routine_days to authenticated;

alter table public.study_routine_days enable row level security;

create policy study_routine_days_own
on public.study_routine_days for all
to authenticated
using (
  owner_id = (select auth.uid())
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('aluno', 'professor', 'admin')
);

-- Fit each owner's latest four populated calendar weeks into the routine.
-- Keep all dated notes in the original table for recovery.
with dated_notes as (
  select *, study_date - (extract(isodow from study_date)::int - 1) as monday
  from public.study_planner_days
), ranked_notes as (
  select *, dense_rank() over (partition by course_id, owner_id order by monday desc) as recency
  from dated_notes
), recent_notes as (
  select *, dense_rank() over (partition by course_id, owner_id order by monday) as week_number
  from ranked_notes
  where recency <= 4
)
insert into public.study_routine_days (course_id, owner_id, week_number, weekday, note)
select course_id, owner_id, week_number::smallint, extract(isodow from study_date)::smallint, note
from recent_notes;
