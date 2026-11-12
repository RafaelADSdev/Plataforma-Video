create table public.activities (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  lesson_id uuid,
  kind text not null check (kind in ('file', 'quiz')),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  instructions text not null default '' check (char_length(instructions) <= 12000),
  position integer not null default 0 check (position >= 0),
  published_at timestamptz,
  due_at timestamptz,
  support_path text,
  support_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (support_path is null and support_name is null)
    or (support_path is not null and support_name is not null
      and kind = 'file' and char_length(support_path) <= 500
      and split_part(support_path, '/', 1) = id::text
      and char_length(support_name) <= 255 and lower(support_name) like '%.pdf')
  )
);

alter table public.lessons add constraint lessons_id_module_unique unique (id, module_id);
alter table public.activities add constraint activities_lesson_module_fkey
  foreign key (lesson_id, module_id) references public.lessons (id, module_id)
  on update cascade on delete cascade;

create index activities_module_position_idx on public.activities (module_id, position, id) where lesson_id is null;
create index activities_lesson_idx on public.activities (lesson_id, published_at) where lesson_id is not null;
create trigger activities_set_updated_at before update on public.activities
for each row execute function private.set_updated_at();

-- Keeping the legacy lesson UUID on the migrated activity also preserves every
-- existing object path and the fallback conversation files written by v1.
insert into public.activities (id, module_id, lesson_id, kind, title, published_at, created_at)
select lesson.id, lesson.module_id, lesson.id, 'file',
  left('Atividade · ' || lesson.title, 160),
  case when lesson.requires_submission then lesson.published_at end,
  lesson.created_at
from public.lessons as lesson
where lesson.requires_submission
  or exists (select 1 from public.submissions where lesson_id = lesson.id)
  or exists (select 1 from public.submission_messages where lesson_id = lesson.id);

drop policy submissions_select_staff_or_own on public.submissions;
drop policy submissions_insert_own_required_lesson on public.submissions;
drop policy submissions_update_own_required_lesson on public.submissions;
drop policy submission_messages_select_staff_or_student on public.submission_messages;
drop policy submission_messages_insert_own_conversation on public.submission_messages;
drop policy submissions_objects_select_staff_or_own on storage.objects;
drop policy submissions_objects_insert_own_required_lesson on storage.objects;
drop policy submissions_objects_update_own_required_lesson on storage.objects;
drop policy submissions_objects_delete_own on storage.objects;
drop policy feedback_objects_select_staff_or_student on storage.objects;
drop policy feedback_objects_insert_own_conversation on storage.objects;

alter table public.submissions drop constraint submissions_lesson_id_fkey;
alter table public.submission_messages drop constraint submission_messages_lesson_id_fkey;
alter table public.submissions rename column lesson_id to activity_id;
alter table public.submission_messages rename column lesson_id to activity_id;
alter table public.submissions add constraint submissions_activity_id_fkey
  foreign key (activity_id) references public.activities(id) on delete cascade;
alter table public.submission_messages add constraint submission_messages_activity_id_fkey
  foreign key (activity_id) references public.activities(id) on delete cascade;
alter table public.submissions rename constraint submissions_user_lesson_unique to submissions_user_activity_unique;
alter index public.submissions_lesson_created_idx rename to submissions_activity_created_idx;
alter table public.lessons drop column requires_submission;

alter table public.activities enable row level security;
revoke all on public.activities from public, anon, authenticated, service_role;
grant select on public.activities to authenticated;
grant select, insert, update, delete on public.activities to service_role;
revoke insert, update on public.submissions from authenticated;
revoke insert on public.submission_messages from authenticated;

create policy activities_select_visible on public.activities for select to authenticated
using (
  not coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false)
  and (
    (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'professor')
    or ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'aluno'
      and published_at <= now()
      and (lesson_id is null or exists (
        select 1 from public.lessons as lesson where lesson.id = activities.lesson_id
          and lesson.published_at <= now()
      )))
  )
);

create policy submissions_select_visible on public.submissions for select to authenticated
using (
  exists (select 1 from public.activities where id = activity_id)
  and ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'professor')
    or user_id = (select auth.uid()))
);

create policy submission_messages_select_visible on public.submission_messages for select to authenticated
using (
  exists (select 1 from public.activities where id = activity_id)
  and ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'professor')
    or student_id = (select auth.uid()))
);

create policy submission_files_select_visible on storage.objects for select to authenticated
using (
  bucket_id in ('submissions', 'feedback')
  and exists (select 1 from public.activities as activity where activity.id::text = (storage.foldername(name))[2])
  and ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'professor')
    or (storage.foldername(name))[1] = (select auth.uid())::text)
);

create policy submission_files_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'submissions'
  and (select auth.jwt() -> 'app_metadata' ->> 'role') = 'aluno'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.activities as activity
    where activity.id::text = (storage.foldername(name))[2] and activity.kind = 'file'
  )
);

create policy feedback_files_insert_participant on storage.objects for insert to authenticated
with check (
  bucket_id = 'feedback'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and exists (
    select 1 from public.submissions as submission
    where submission.activity_id::text = (storage.foldername(name))[2]
      and submission.user_id::text = (storage.foldername(name))[1]
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('activity-materials', 'activity-materials', false, 20971520, array['application/pdf']);

create policy activity_material_staff on storage.objects for all to authenticated
using (bucket_id = 'activity-materials' and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'professor'))
with check (bucket_id = 'activity-materials' and (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'professor'));

create policy activity_material_select_visible on storage.objects for select to authenticated
using (
  bucket_id = 'activity-materials'
  and exists (select 1 from public.activities where support_path = storage.objects.name)
);

create function private.activity_available(activity public.activities)
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce(activity.published_at <= now(), false)
    and (activity.lesson_id is null or exists (
      select 1 from public.lessons where id = activity.lesson_id and published_at <= now()
    ))
$$;

-- Allocate one shared order for lessons and standalone activities.
with ranked as (
  select id, row_number() over (partition by module_id order by position, id) as position
  from public.lessons
)
update public.lessons set position = ranked.position from ranked where lessons.id = ranked.id;

create function private.assign_course_item_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'activities' then
    if new.lesson_id is not null then
      new.position := 0;
      return new;
    end if;
    if tg_op = 'UPDATE' then
      if old.module_id = new.module_id and old.lesson_id is null then
        return new;
      end if;
    end if;
  elsif tg_op = 'UPDATE' then
    if old.module_id = new.module_id then
      return new;
    end if;
  end if;

  perform 1 from public.modules where id = new.module_id for update;
  select greatest(
    coalesce((select max(position) from public.lessons where module_id = new.module_id), 0),
    coalesce((select max(position) from public.activities where module_id = new.module_id and lesson_id is null), 0)
  ) + 1 into new.position;
  return new;
end;
$$;

create trigger assign_lesson_position before insert or update of module_id on public.lessons
for each row execute function private.assign_course_item_position();
create trigger assign_activity_position before insert or update of module_id, lesson_id on public.activities
for each row execute function private.assign_course_item_position();

create function public.reorder_course_item(p_module_id uuid, p_item_id uuid, p_is_activity boolean, p_direction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_position integer;
  adjacent record;
begin
  if not coalesce(auth.jwt() -> 'app_metadata' ->> 'role' in ('professor', 'admin'), false)
    or p_direction not in ('up', 'down') then
    raise exception 'Não é possível reorganizar o módulo.' using errcode = '42501';
  end if;

  perform 1 from public.modules where id = p_module_id for update;
  if p_is_activity then
    select position into current_position from public.activities
      where id = p_item_id and module_id = p_module_id and lesson_id is null;
  else
    select position into current_position from public.lessons where id = p_item_id and module_id = p_module_id;
  end if;
  if current_position is null then
    raise exception 'Item fora do módulo.' using errcode = 'P0001';
  end if;

  select * into adjacent from (
    select id, position, false as is_activity from public.lessons where module_id = p_module_id
    union all
    select id, position, true from public.activities where module_id = p_module_id and lesson_id is null
  ) as items
  where (p_direction = 'up' and position < current_position)
    or (p_direction = 'down' and position > current_position)
  order by case when p_direction = 'up' then -position else position end, id
  limit 1;
  if not found then return; end if;

  if p_is_activity then
    update public.activities set position = adjacent.position where id = p_item_id;
  else
    update public.lessons set position = adjacent.position where id = p_item_id;
  end if;
  if adjacent.is_activity then
    update public.activities set position = current_position where id = adjacent.id;
  else
    update public.lessons set position = current_position where id = adjacent.id;
  end if;
end;
$$;

-- The browser can stage an object, but only this function can record it.
create function public.record_activity_submission(p_activity_id uuid, p_path text, p_filename text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  file_metadata jsonb;
begin
  if actor is null or not coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'aluno', false)
    or not exists (select 1 from public.activities as a where a.id = p_activity_id and a.kind = 'file'
      and private.activity_available(a))
    or not coalesce(starts_with(p_path, actor::text || '/' || p_activity_id::text || '/'), false)
    or char_length(p_path) > 500 then
    raise exception 'Atividade indisponível para envio.' using errcode = '42501';
  end if;

  select metadata into file_metadata from storage.objects
    where bucket_id = 'submissions' and name = p_path and owner_id = actor::text;
  if file_metadata is null or coalesce((file_metadata ->> 'size')::bigint, 0) not between 1 and 20971520
    or file_metadata ->> 'mimetype' is null then
    raise exception 'Arquivo da entrega não encontrado.' using errcode = 'P0001';
  end if;

  insert into public.submissions (activity_id, user_id, storage_path, file_name, mime_type, size_bytes)
  values (p_activity_id, actor, p_path, btrim(p_filename), file_metadata ->> 'mimetype', (file_metadata ->> 'size')::bigint)
  on conflict (user_id, activity_id) do update
  set storage_path = excluded.storage_path, file_name = excluded.file_name,
    mime_type = excluded.mime_type, size_bytes = excluded.size_bytes
  where submissions.storage_path <> excluded.storage_path;
end;
$$;

create function public.send_activity_feedback(
  p_activity_id uuid, p_student_id uuid, p_body text, p_path text, p_filename text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  role text := auth.jwt() -> 'app_metadata' ->> 'role';
  file_metadata jsonb;
begin
  if actor is null or not coalesce(role in ('professor', 'admin') or (role = 'aluno' and actor = p_student_id), false)
    or not exists (
      select 1 from public.submissions as submission
      join public.activities as activity on activity.id = submission.activity_id
      where submission.activity_id = p_activity_id and submission.user_id = p_student_id
        and (role in ('professor', 'admin') or private.activity_available(activity))
    ) then
    raise exception 'Conversa indisponível.' using errcode = '42501';
  end if;

  if p_path is not null then
    if char_length(p_path) > 500
      or not starts_with(p_path, p_student_id::text || '/' || p_activity_id::text || '/' || actor::text || '/') then
      raise exception 'Arquivo inválido.' using errcode = '42501';
    end if;
    select metadata into file_metadata from storage.objects
      where bucket_id = 'feedback' and name = p_path and owner_id = actor::text;
    if file_metadata is null then
      raise exception 'Arquivo da mensagem não encontrado.' using errcode = 'P0001';
    end if;
  end if;

  insert into public.submission_messages
    (activity_id, student_id, author_id, body, storage_path, file_name, mime_type, size_bytes)
  values (
    p_activity_id, p_student_id, actor, coalesce(btrim(p_body), ''), p_path,
    case when p_path is not null then btrim(p_filename) end,
    file_metadata ->> 'mimetype', (file_metadata ->> 'size')::bigint
  );
end;
$$;

revoke all on function public.reorder_course_item(uuid, uuid, boolean, text),
  public.record_activity_submission(uuid, text, text),
  public.send_activity_feedback(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reorder_course_item(uuid, uuid, boolean, text),
  public.record_activity_submission(uuid, text, text),
  public.send_activity_feedback(uuid, uuid, text, text, text) to authenticated;
revoke all on function private.activity_available(public.activities), private.assign_course_item_position() from public, anon, authenticated;

alter table public.notifications drop constraint notifications_reference_check;
alter table public.notifications add constraint notifications_reference_check check (
  (type = 'comment' and lesson_id is not null and comment_id is not null and thread_id is null and submission_id is null)
  or (type = 'community' and lesson_id is null and comment_id is null and thread_id is not null and submission_id is null)
  or (type = 'submission' and comment_id is null and thread_id is null and submission_id is not null)
  or (type = 'feedback' and comment_id is null and thread_id is null and (submission_id is not null or lesson_id is not null))
);

create function private.notify_activity_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, submission_id)
  select staff.id, new.user_id, 'submission', new.id
  from auth.users as staff
  where staff.raw_app_meta_data ->> 'role' in ('professor', 'admin') and staff.id <> new.user_id;
  return new;
end;
$$;

drop trigger submissions_notify_staff on public.submissions;
create trigger submissions_notify_staff after insert or update of storage_path on public.submissions
for each row execute function private.notify_activity_submission();
revoke all on function private.notify_activity_submission() from public, anon, authenticated;

create or replace function private.notify_on_submission_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_submission_id uuid;
begin
  select raw_app_meta_data ->> 'role' into actor_role from auth.users where id = new.author_id;
  select id into target_submission_id from public.submissions
    where activity_id = new.activity_id and user_id = new.student_id;
  if target_submission_id is null then return new; end if;

  if actor_role = 'aluno' then
    insert into public.notifications (recipient_id, actor_id, type, submission_id)
    select staff.id, new.author_id, 'feedback', target_submission_id from auth.users as staff
    where staff.raw_app_meta_data ->> 'role' in ('professor', 'admin') and staff.id <> new.author_id;
  elsif actor_role in ('professor', 'admin') and new.student_id <> new.author_id then
    insert into public.notifications (recipient_id, actor_id, type, submission_id)
    values (new.student_id, new.author_id, 'feedback', target_submission_id);
  end if;
  return new;
end;
$$;
