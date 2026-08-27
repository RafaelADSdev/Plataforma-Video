-- Recurring weekly study timetable. owner_id is null for the teacher
-- recommendation; students own their personal copy independently.

create table public.weekly_schedule_slots (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  weekday smallint not null,
  starts_at time not null,
  ends_at time,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint weekly_schedule_slots_weekday_check check (weekday between 1 and 7),
  constraint weekly_schedule_slots_time_range_check check (
    ends_at is null or ends_at > starts_at
  ),
  constraint weekly_schedule_slots_note_check check (char_length(note) <= 280)
);

create unique index weekly_schedule_slots_recommended_unique
  on public.weekly_schedule_slots (course_id, weekday, starts_at)
  where owner_id is null;

create unique index weekly_schedule_slots_personal_unique
  on public.weekly_schedule_slots (course_id, owner_id, weekday, starts_at)
  where owner_id is not null;

create index weekly_schedule_slots_recommended_idx
  on public.weekly_schedule_slots (course_id, weekday, starts_at)
  where owner_id is null;

create index weekly_schedule_slots_personal_idx
  on public.weekly_schedule_slots (course_id, owner_id, weekday, starts_at)
  where owner_id is not null;

create function private.enforce_weekly_schedule_slot_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slot_count integer;
begin
  if new.owner_id is null then
    select count(*) into slot_count
    from public.weekly_schedule_slots
    where course_id = new.course_id
      and owner_id is null;
  else
    select count(*) into slot_count
    from public.weekly_schedule_slots
    where course_id = new.course_id
      and owner_id = new.owner_id;
  end if;

  if slot_count >= 28 then
    raise exception 'Cada cronograma pode ter no máximo 28 horários.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger weekly_schedule_slots_limit
before insert on public.weekly_schedule_slots
for each row execute function private.enforce_weekly_schedule_slot_limit();

revoke all on function private.enforce_weekly_schedule_slot_limit() from public, anon, authenticated;

revoke all on table public.weekly_schedule_slots from anon, authenticated, service_role;
grant select, insert, update, delete on table public.weekly_schedule_slots to authenticated;
grant select, insert, update, delete on table public.weekly_schedule_slots to service_role;

alter table public.weekly_schedule_slots enable row level security;

create policy weekly_schedule_slots_select_visible
on public.weekly_schedule_slots for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
  and (
    owner_id is null
    or owner_id = (select auth.uid())
  )
);

create policy weekly_schedule_slots_insert_own_or_recommended
on public.weekly_schedule_slots for insert
to authenticated
with check (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
        in ('professor', 'admin')
      and owner_id is null
    )
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and owner_id = (select auth.uid())
    )
  )
);

create policy weekly_schedule_slots_update_own_or_recommended
on public.weekly_schedule_slots for update
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
        in ('professor', 'admin')
      and owner_id is null
    )
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and owner_id = (select auth.uid())
    )
  )
)
with check (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
        in ('professor', 'admin')
      and owner_id is null
    )
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and owner_id = (select auth.uid())
    )
  )
);

create policy weekly_schedule_slots_delete_own_or_recommended
on public.weekly_schedule_slots for delete
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
        in ('professor', 'admin')
      and owner_id is null
    )
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and owner_id = (select auth.uid())
    )
  )
);

comment on table public.weekly_schedule_slots is
  'Weekly recurring study slots. owner_id null is the staff recommendation; a user id is the student copy.';

comment on column public.weekly_schedule_slots.weekday is
  'ISO weekday: 1 Monday through 7 Sunday, interpreted as America/Sao_Paulo civil days.';

comment on column public.weekly_schedule_slots.starts_at is
  'Local wall-clock time in America/Sao_Paulo; not a timestamptz instant.';
