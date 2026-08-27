-- Private 1:1 conversation between staff and a student about a lesson
-- delivery. The thread is keyed by (lesson_id, student_id) so replacing the
-- submitted file does not wipe the messages.

create table public.submission_messages (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '',
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint submission_messages_body_check check (
    char_length(body) <= 4000
  ),
  constraint submission_messages_has_content_check check (
    char_length(btrim(body)) >= 1
    or storage_path is not null
  ),
  constraint submission_messages_file_consistency_check check (
    (
      storage_path is null
      and file_name is null
      and mime_type is null
      and size_bytes is null
    )
    or (
      storage_path is not null
      and file_name is not null
      and mime_type is not null
      and size_bytes is not null
    )
  ),
  constraint submission_messages_storage_path_check check (
    storage_path is null or char_length(btrim(storage_path)) > 0
  ),
  constraint submission_messages_file_name_check check (
    file_name is null
    or (
      char_length(btrim(file_name)) between 1 and 255
      and lower(file_name) ~ '[.](jpe?g|png|webp|pdf)$'
    )
  ),
  constraint submission_messages_mime_type_check check (
    mime_type is null
    or lower(mime_type) in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    )
  ),
  constraint submission_messages_size_check check (
    size_bytes is null or size_bytes between 1 and 20971520
  ),
  constraint submission_messages_storage_path_unique unique (storage_path)
);

create index submission_messages_conversation_idx
  on public.submission_messages (lesson_id, student_id, created_at);

revoke all on table public.submission_messages from anon, authenticated, service_role;
grant select, insert on table public.submission_messages to authenticated;
grant select, insert, update, delete on table public.submission_messages to service_role;

alter table public.submission_messages enable row level security;

create policy submission_messages_select_staff_or_student
on public.submission_messages for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and (select auth.uid()) = student_id
    )
  )
);

create policy submission_messages_insert_own_conversation
on public.submission_messages for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id = submission_messages.lesson_id
      and lesson.requires_submission
  )
  and exists (
    select 1
    from public.submissions as submission
    where submission.lesson_id = submission_messages.lesson_id
      and submission.user_id = submission_messages.student_id
  )
  and (
    (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and (select auth.uid()) = student_id
    )
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
  )
);

-- Feedback files live in a private bucket. Path:
-- <student_id>/<lesson_id>/<author_id>/<file>
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'feedback',
  'feedback',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy feedback_objects_select_staff_or_student
on storage.objects for select
to authenticated
using (
  bucket_id = 'feedback'
  and (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
  )
);

create policy feedback_objects_insert_own_conversation
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'feedback'
  and (storage.foldername(name))[3] = (select auth.uid())::text
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id::text = (storage.foldername(name))[2]
      and lesson.requires_submission
  )
  and exists (
    select 1
    from public.submissions as submission
    where submission.lesson_id::text = (storage.foldername(name))[2]
      and submission.user_id::text = (storage.foldername(name))[1]
  )
  and (
    (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
  )
);

-- Staff still receive student activity; students now also receive a notice
-- when a professor replies on their delivery.
alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('comment', 'community', 'submission', 'feedback'));

alter table public.notifications
  drop constraint notifications_reference_check;

alter table public.notifications
  add constraint notifications_reference_check
  check (
    (
      type = 'comment'
      and lesson_id is not null
      and comment_id is not null
      and thread_id is null
      and submission_id is null
    )
    or (
      type = 'community'
      and lesson_id is null
      and comment_id is null
      and thread_id is not null
      and submission_id is null
    )
    or (
      type = 'submission'
      and lesson_id is not null
      and comment_id is null
      and thread_id is null
      and submission_id is not null
    )
    or (
      type = 'feedback'
      and lesson_id is not null
      and comment_id is null
      and thread_id is null
    )
  );

drop policy notifications_select_recipient_staff on public.notifications;
drop policy notifications_update_recipient_staff on public.notifications;

create policy notifications_select_recipient
on public.notifications for select
to authenticated
using (
  (select auth.uid()) = recipient_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy notifications_update_recipient
on public.notifications for update
to authenticated
using (
  (select auth.uid()) = recipient_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
)
with check (
  (select auth.uid()) = recipient_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create function private.notify_on_submission_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_submission_id uuid;
begin
  if tg_table_schema <> 'public' or tg_table_name <> 'submission_messages' then
    raise exception 'Origem de notificação inválida.' using errcode = '42501';
  end if;

  if tg_op <> 'INSERT' then
    raise exception 'Operação de notificação inválida.' using errcode = '42501';
  end if;

  if auth.uid() is not null and auth.uid() <> new.author_id then
    raise exception 'Ator da notificação não corresponde à sessão.'
      using errcode = '42501';
  end if;

  select coalesce(auth_user.raw_app_meta_data ->> 'role', '')
    into actor_role
  from auth.users as auth_user
  where auth_user.id = new.author_id;

  select submission.id
    into target_submission_id
  from public.submissions as submission
  where submission.lesson_id = new.lesson_id
    and submission.user_id = new.student_id;

  if actor_role = 'aluno' then
    insert into public.notifications (
      recipient_id,
      actor_id,
      type,
      lesson_id,
      submission_id
    )
    select
      staff.id,
      new.author_id,
      'feedback',
      new.lesson_id,
      target_submission_id
    from auth.users as staff
    where coalesce(staff.raw_app_meta_data ->> 'role', '') in ('professor', 'admin')
      and staff.id <> new.author_id;
  elsif actor_role in ('professor', 'admin') and new.student_id <> new.author_id then
    insert into public.notifications (
      recipient_id,
      actor_id,
      type,
      lesson_id,
      submission_id
    )
    values (
      new.student_id,
      new.author_id,
      'feedback',
      new.lesson_id,
      target_submission_id
    );
  end if;

  return new;
end;
$$;

create trigger submission_messages_notify
after insert on public.submission_messages
for each row execute function private.notify_on_submission_message();

revoke all on function private.notify_on_submission_message() from public, anon, authenticated;

comment on table public.submission_messages is
  'Private 1:1 messages between staff and one student about a lesson delivery.';

comment on column public.submission_messages.storage_path is
  'Optional file inside the private feedback bucket; convention student_id/lesson_id/author_id/file.';
