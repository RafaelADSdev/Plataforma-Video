alter table public.modules
  add column lessons_in_order boolean not null default false,
  add column require_previous_modules boolean not null default false;

alter table public.lesson_progress
  add column played_ms int4multirange not null default '{}';

create function private.module_is_locked(p_module_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.modules as target
    join public.modules as earlier on earlier.course_id = target.course_id
      and (earlier.position, earlier.id) < (target.position, target.id)
    join public.lessons as prerequisite on prerequisite.module_id = earlier.id
    where target.id = p_module_id and target.require_previous_modules
      and prerequisite.published_at <= now()
      and not exists (
        select 1 from public.lesson_progress
        where lesson_id = prerequisite.id and user_id = (select auth.uid()) and watched
      )
  );
$$;

create function private.lesson_lock_reason(lesson public.lessons)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when private.module_is_locked(lesson.module_id) then 'module'
    when exists (
      select 1
      from public.modules as module
      join public.lessons as prerequisite on prerequisite.module_id = module.id
      where module.id = lesson.module_id and module.lessons_in_order
        and (prerequisite.position, prerequisite.id) < (lesson.position, lesson.id)
        and prerequisite.published_at <= now()
        and not exists (
          select 1 from public.lesson_progress
          where lesson_id = prerequisite.id and user_id = (select auth.uid()) and watched
        )
    ) then 'lesson'
  end;
$$;

create function private.lesson_requires_playback(lesson public.lessons)
returns boolean
language sql stable
set search_path = ''
as $$
  select (lesson.video_status <> 'none' or lesson.youtube_video_id is not null) and exists (
    select 1 from public.modules as module
    where module.id = lesson.module_id and (
      module.lessons_in_order or exists (
        select 1 from public.modules as later
        where later.course_id = module.course_id and later.require_previous_modules
          and (later.position, later.id) > (module.position, module.id)
      )
    )
  );
$$;

alter policy lessons_select_visible on public.lessons using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (
    (select auth.jwt() -> 'app_metadata' ->> 'role') in ('professor', 'admin')
    or ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'aluno'
      and published_at <= now() and private.lesson_lock_reason(lessons) is null)
  )
);

-- The catalog exposes titles and lock status without exposing lesson content.
create function public.course_lesson_catalog(p_module_id uuid default null, p_lesson_id uuid default null)
returns table (
  id uuid, module_id uuid, title text, "position" integer, video_status text,
  published_at timestamptz, lock_reason text, requires_playback boolean, youtube_video_id text
)
language sql stable security definer
set search_path = ''
as $$
  with viewer as (
    select auth.jwt() -> 'app_metadata' ->> 'role' as role
    where auth.uid() is not null and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  )
  select lesson.id, lesson.module_id, lesson.title, lesson.position, lesson.video_status,
    lesson.published_at,
    access.lock_reason,
    case when viewer.role = 'aluno' then private.lesson_requires_playback(lesson) else false end,
    case when access.lock_reason is null then lesson.youtube_video_id end
  from public.lessons as lesson cross join viewer
  cross join lateral (select case when viewer.role = 'aluno' then private.lesson_lock_reason(lesson) end as lock_reason) as access
  where (p_module_id is null or lesson.module_id = p_module_id)
    and (p_lesson_id is null or lesson.id = p_lesson_id)
    and (viewer.role in ('professor', 'admin') or (viewer.role = 'aluno' and lesson.published_at <= now()));
$$;

create function public.course_locked_modules()
returns table (id uuid)
language sql stable security definer
set search_path = ''
as $$
  select module.id from public.modules as module
  where (select auth.uid()) is not null and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'aluno'
    and not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
    and module.require_previous_modules and private.module_is_locked(module.id);
$$;

create or replace function private.activity_available(activity public.activities)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(activity.published_at <= now(), false) and case
    when activity.lesson_id is null then not private.module_is_locked(activity.module_id)
    else exists (
      select 1 from public.lessons as lesson
      where lesson.id = activity.lesson_id and lesson.published_at <= now()
        and private.lesson_lock_reason(lesson) is null
    )
  end;
$$;

alter policy activities_select_visible on public.activities using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (
    (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'professor')
    or ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'aluno' and private.activity_available(activities))
  )
);

grant execute on function private.lesson_lock_reason(public.lessons),
  private.activity_available(public.activities), public.course_lesson_catalog(uuid, uuid),
  public.course_locked_modules() to authenticated;

-- Progress can only be written through the checked RPC. Merge coverage on
-- conflict so separate sessions can add watched sections without losing any.
revoke insert, update on public.lesson_progress from authenticated;
drop policy lesson_progress_insert_own_published on public.lesson_progress;
drop policy lesson_progress_update_own_published on public.lesson_progress;
drop function public.save_lesson_progress(uuid, integer, boolean, boolean);

create function private.video_coverage_complete(coverage int4multirange, duration_ms integer)
returns boolean
language sql immutable strict
set search_path = ''
as $$
  select duration_ms > 0 and coalesce(sum(upper(section) - lower(section)), 0) * 10 >= duration_ms::bigint * 9
  from unnest(coverage * int4multirange(int4range(0, greatest(0, duration_ms)))) as section;
$$;

create function public.save_lesson_progress(
  p_lesson_id uuid, p_seconds integer, p_watched boolean, p_manual boolean,
  p_duration_ms integer default null, p_played_ms jsonb default '[]'::jsonb
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  lesson public.lessons;
  requires_playback boolean;
  coverage int4multirange := '{}';
  complete boolean;
begin
  if actor is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    or not coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'aluno', false) then
    raise exception 'Progresso disponível apenas para alunos.' using errcode = '42501';
  end if;

  select * into lesson from public.lessons where id = p_lesson_id and published_at <= now();
  if not found or private.lesson_lock_reason(lesson) is not null then
    raise exception 'Aula indisponível.' using errcode = '42501';
  end if;

  requires_playback := private.lesson_requires_playback(lesson);
  if requires_playback and p_manual then
    raise exception 'A conclusão desta aula depende da reprodução do vídeo.' using errcode = '42501';
  end if;

  if requires_playback and (lesson.video_status = 'ready' or lesson.youtube_video_id is not null)
    and p_duration_ms between 1 and 86400000
    and jsonb_typeof(p_played_ms) = 'array' then
    if jsonb_array_length(p_played_ms) <= 256 then
      select coalesce(range_agg(int4range(start_ms, end_ms)), '{}') into coverage
      from jsonb_to_recordset(p_played_ms) as played(start_ms integer, end_ms integer)
      where start_ms >= 0 and end_ms > start_ms and end_ms <= p_duration_ms;
    end if;
  end if;

  insert into public.lesson_progress (lesson_id, user_id, last_seconds, watched, played_ms)
  values (p_lesson_id, actor, p_seconds, case when requires_playback
    then coalesce(private.video_coverage_complete(coverage, p_duration_ms), false)
    else coalesce(p_watched, false) end, coverage)
  on conflict (lesson_id, user_id) do update set
    last_seconds = excluded.last_seconds,
    played_ms = lesson_progress.played_ms + excluded.played_ms,
    watched = case
      when p_manual then excluded.watched
      else lesson_progress.watched or excluded.watched or (
        requires_playback and coverage <> '{}' and
        private.video_coverage_complete(lesson_progress.played_ms + excluded.played_ms, p_duration_ms)
      )
    end
  returning watched into complete;
  return complete;
end;
$$;

grant execute on function public.save_lesson_progress(uuid, integer, boolean, boolean, integer, jsonb) to authenticated;
