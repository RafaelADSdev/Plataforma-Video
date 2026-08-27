-- Initial database, authorization and Storage model for the single-course v1.
-- All application authorization comes from auth.users.raw_app_meta_data.role.

-- New Supabase projects no longer expose new public objects automatically.
-- Opt into the safer behavior here as well, then grant each application object
-- explicitly below so this migration behaves the same on old and new projects.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated, service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter default privileges for role postgres in schema private
  revoke execute on functions from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true,
  title text not null,
  cover_path text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_singleton_check check (singleton),
  constraint courses_singleton_unique unique (singleton),
  constraint courses_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint courses_description_check check (
    description is null or char_length(description) <= 600
  ),
  constraint courses_cover_path_check check (
    cover_path is null or char_length(btrim(cover_path)) > 0
  )
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  scheduled_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint modules_title_check check (char_length(btrim(title)) between 1 and 160),
  constraint modules_position_check check (position >= 0)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  title text not null,
  content text not null default '',
  youtube_url text,
  position integer not null default 0,
  requires_submission boolean not null default false,
  published_at timestamptz not null default now(),
  scheduled_for date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lessons_title_check check (char_length(btrim(title)) between 1 and 200),
  constraint lessons_position_check check (position >= 0),
  constraint lessons_youtube_url_check check (
    youtube_url is null
    or btrim(youtube_url) ~* '^(https?://)?(www\.)?youtu\.be/[A-Za-z0-9_-]{11}/?([?#].*)?$'
    or btrim(youtube_url) ~* '^(https?://)?((www|m)\.)?youtube\.com/(embed|shorts)/[A-Za-z0-9_-]{11}/?([?#].*)?$'
    or btrim(youtube_url) ~* '^(https?://)?((www|m)\.)?youtube\.com/watch/?\?([^#]*&)?v=[A-Za-z0-9_-]{11}(&[^#]*)?(#.*)?$'
  )
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text not null default 'application/pdf',
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint materials_name_check check (
    char_length(btrim(name)) between 1 and 255 and lower(name) ~ '[.]pdf$'
  ),
  constraint materials_storage_path_check check (char_length(btrim(storage_path)) > 0),
  constraint materials_storage_path_unique unique (storage_path),
  constraint materials_mime_type_check check (lower(mime_type) = 'application/pdf'),
  constraint materials_size_check check (
    size_bytes is null or size_bytes between 1 and 20971520
  )
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seconds integer not null default 0,
  watched boolean not null default false,
  watched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_progress_user_lesson_unique unique (user_id, lesson_id),
  constraint lesson_progress_seconds_check check (last_seconds >= 0),
  constraint lesson_progress_watched_at_check check (
    (watched and watched_at is not null) or (not watched and watched_at is null)
  )
);

create table public.lesson_comments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  t_seconds integer,
  created_at timestamptz not null default now(),
  constraint lesson_comments_body_check check (char_length(btrim(body)) between 1 and 4000),
  constraint lesson_comments_seconds_check check (t_seconds is null or t_seconds >= 0)
);

create table public.community_threads (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint community_threads_title_check check (
    char_length(btrim(title)) between 1 and 200
  ),
  constraint community_threads_body_check check (
    char_length(btrim(body)) between 1 and 10000
  )
);

create table public.community_replies (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  is_staff boolean not null default false,
  created_at timestamptz not null default now(),
  constraint community_replies_body_check check (
    char_length(btrim(body)) between 1 and 10000
  )
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submissions_user_lesson_unique unique (user_id, lesson_id),
  constraint submissions_storage_path_unique unique (storage_path),
  constraint submissions_storage_path_check check (char_length(btrim(storage_path)) > 0),
  constraint submissions_file_name_check check (
    char_length(btrim(file_name)) between 1 and 255
    and lower(file_name) ~ '[.](jpe?g|png|webp|pdf)$'
  ),
  constraint submissions_mime_type_check check (
    lower(mime_type) in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf'
    )
  ),
  constraint submissions_size_check check (
    size_bytes is null or size_bytes between 1 and 20971520
  )
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  bio text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_check check (
    display_name is null or char_length(btrim(display_name)) between 1 and 100
  ),
  constraint profiles_bio_check check (bio is null or char_length(bio) <= 500),
  constraint profiles_avatar_path_check check (
    avatar_path is null or char_length(btrim(avatar_path)) > 0
  )
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  lesson_id uuid references public.lessons(id) on delete cascade,
  comment_id uuid references public.lesson_comments(id) on delete cascade,
  thread_id uuid references public.community_threads(id) on delete cascade,
  submission_id uuid references public.submissions(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('comment', 'community', 'submission')),
  constraint notifications_reference_check check (
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
  )
);

-- ---------------------------------------------------------------------------
-- Seed: one and only one course in this deployment
-- ---------------------------------------------------------------------------

insert into public.courses (id, singleton, title)
values ('00000000-0000-0000-0000-000000000001', true, 'Meu curso')
on conflict (singleton) do nothing;

-- ---------------------------------------------------------------------------
-- Indexes for ordering, visibility filters, ownership and notification inboxes
-- ---------------------------------------------------------------------------

create index modules_course_position_idx
  on public.modules (course_id, position, created_at);

create index lessons_module_position_idx
  on public.lessons (module_id, position, created_at);

create index lessons_published_at_idx
  on public.lessons (published_at);

create index lessons_scheduled_for_idx
  on public.lessons (scheduled_for)
  where scheduled_for is not null;

create index materials_lesson_created_idx
  on public.materials (lesson_id, created_at);

create index lesson_progress_user_updated_idx
  on public.lesson_progress (user_id, updated_at desc);

create index lesson_progress_lesson_idx
  on public.lesson_progress (lesson_id);

create index lesson_comments_lesson_created_idx
  on public.lesson_comments (lesson_id, created_at);

create index lesson_comments_author_idx
  on public.lesson_comments (author_id);

create index community_threads_course_created_idx
  on public.community_threads (course_id, created_at desc);

create index community_threads_author_idx
  on public.community_threads (author_id);

create index community_replies_thread_staff_created_idx
  on public.community_replies (thread_id, is_staff desc, created_at);

create index community_replies_author_idx
  on public.community_replies (author_id);

create index submissions_lesson_created_idx
  on public.submissions (lesson_id, created_at desc);

create index submissions_user_idx
  on public.submissions (user_id);

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- Integrity and automation triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end;
$$;

create trigger courses_set_updated_at
before update on public.courses
for each row execute function private.set_updated_at();

create trigger modules_set_updated_at
before update on public.modules
for each row execute function private.set_updated_at();

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function private.set_updated_at();

create trigger materials_set_updated_at
before update on public.materials
for each row execute function private.set_updated_at();

create trigger lesson_progress_set_updated_at
before update on public.lesson_progress
for each row execute function private.set_updated_at();

create trigger submissions_set_updated_at
before update on public.submissions
for each row execute function private.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- Keep watched_at consistent even when watched is toggled by an upsert.
create function private.sync_lesson_progress_watched_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.watched then
    new.watched_at := coalesce(new.watched_at, statement_timestamp());
  else
    new.watched_at := null;
  end if;
  return new;
end;
$$;

create trigger lesson_progress_sync_watched_at
before insert or update of watched, watched_at on public.lesson_progress
for each row execute function private.sync_lesson_progress_watched_at();

-- The client cannot forge highlighted professor/admin replies.
create function private.set_community_reply_staff()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  jwt_user_id uuid := auth.uid();
  jwt_role text := coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '');
begin
  if jwt_user_id is null or new.author_id <> jwt_user_id then
    raise exception 'O autor da resposta deve ser o usuário autenticado.'
      using errcode = '42501';
  end if;

  new.is_staff := jwt_role in ('professor', 'admin');
  return new;
end;
$$;

create trigger community_replies_set_staff
before insert on public.community_replies
for each row execute function private.set_community_reply_staff();

-- A lesson without video can only have untimed comments.
create function private.normalize_lesson_comment_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.lessons as lesson
    where lesson.id = new.lesson_id
      and lesson.youtube_url is not null
  ) then
    new.t_seconds := null;
  end if;
  return new;
end;
$$;

create trigger lesson_comments_normalize_timestamp
before insert on public.lesson_comments
for each row execute function private.normalize_lesson_comment_timestamp();

-- Whenever Auth Admin applies app_metadata (it happens in an UPDATE after the
-- initial auth.users INSERT), the application role must be one of the real
-- roles. RLS below also fails closed while a user has no valid role.
create function private.enforce_auth_user_app_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_role text := coalesce(new.raw_app_meta_data ->> 'role', '');
begin
  if app_role not in ('admin', 'professor', 'aluno') then
    raise exception 'Todo usuário precisa de app_metadata.role válido.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger auth_users_enforce_app_role
before update of raw_app_meta_data on auth.users
for each row execute function private.enforce_auth_user_app_role();

-- Auth Admin creation automatically provisions the public profile.
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      new.email
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_users_create_profile
after insert on auth.users
for each row execute function private.handle_new_auth_user();

-- Backfill a profile if this migration is applied after initial Auth users exist.
insert into public.profiles (id, display_name)
select
  auth_user.id,
  coalesce(
    nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
    auth_user.email
  )
from auth.users as auth_user
where coalesce(auth_user.raw_app_meta_data ->> 'role', '') in ('admin', 'professor', 'aluno')
on conflict (id) do nothing;

-- Notifications are generated inside the database so clients cannot omit them.
-- This function must bypass notification RLS and read auth.users, therefore it is
-- SECURITY DEFINER, lives outside the exposed schema, has an empty search_path,
-- validates its trigger source and is not executable by client roles.
create function private.notify_staff_on_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid;
  actor_role text;
  notification_type text;
  target_lesson_id uuid;
  target_comment_id uuid;
  target_thread_id uuid;
  target_submission_id uuid;
begin
  if tg_table_schema <> 'public' then
    raise exception 'Origem de notificação inválida.' using errcode = '42501';
  end if;

  case tg_table_name
    when 'lesson_comments' then
      if tg_op <> 'INSERT' then
        raise exception 'Operação de notificação inválida.' using errcode = '42501';
      end if;
      actor_user_id := new.author_id;
      notification_type := 'comment';
      target_lesson_id := new.lesson_id;
      target_comment_id := new.id;

    when 'community_threads' then
      if tg_op <> 'INSERT' then
        raise exception 'Operação de notificação inválida.' using errcode = '42501';
      end if;
      actor_user_id := new.author_id;
      notification_type := 'community';
      target_thread_id := new.id;

    when 'submissions' then
      if tg_op not in ('INSERT', 'UPDATE') then
        raise exception 'Operação de notificação inválida.' using errcode = '42501';
      end if;
      actor_user_id := new.user_id;
      notification_type := 'submission';
      target_lesson_id := new.lesson_id;
      target_submission_id := new.id;

    else
      raise exception 'Tabela de notificação inválida.' using errcode = '42501';
  end case;

  if actor_user_id is null then
    raise exception 'Ator da notificação ausente.' using errcode = '23502';
  end if;

  -- For user-scoped requests, the activity row must belong to the JWT subject.
  if auth.uid() is not null and auth.uid() <> actor_user_id then
    raise exception 'Ator da notificação não corresponde à sessão.'
      using errcode = '42501';
  end if;

  select coalesce(auth_user.raw_app_meta_data ->> 'role', '')
    into actor_role
  from auth.users as auth_user
  where auth_user.id = actor_user_id;

  -- Only student activity belongs in the professor inbox.
  if actor_role <> 'aluno' then
    return new;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    lesson_id,
    comment_id,
    thread_id,
    submission_id
  )
  select
    staff.id,
    actor_user_id,
    notification_type,
    target_lesson_id,
    target_comment_id,
    target_thread_id,
    target_submission_id
  from auth.users as staff
  where coalesce(staff.raw_app_meta_data ->> 'role', '') in ('professor', 'admin')
    and staff.id <> actor_user_id;

  return new;
end;
$$;

create trigger lesson_comments_notify_staff
after insert on public.lesson_comments
for each row execute function private.notify_staff_on_activity();

create trigger community_threads_notify_staff
after insert on public.community_threads
for each row execute function private.notify_staff_on_activity();

create trigger submissions_notify_staff
after insert or update of storage_path, file_name, mime_type, size_bytes
on public.submissions
for each row execute function private.notify_staff_on_activity();

revoke all on all functions in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Data API grants (RLS still decides which rows each authenticated user sees)
-- ---------------------------------------------------------------------------

revoke all on table
  public.courses,
  public.modules,
  public.lessons,
  public.materials,
  public.lesson_progress,
  public.lesson_comments,
  public.community_threads,
  public.community_replies,
  public.submissions,
  public.profiles,
  public.notifications
from anon, authenticated, service_role;

grant select on table public.courses to authenticated;
grant update (title, cover_path, description) on table public.courses to authenticated;

grant select, insert, update, delete on table public.modules to authenticated;
grant select, insert, update, delete on table public.lessons to authenticated;
grant select, insert, update, delete on table public.materials to authenticated;
grant select, insert, update on table public.lesson_progress to authenticated;
grant select, insert on table public.lesson_comments to authenticated;
grant select, insert on table public.community_threads to authenticated;
grant select, insert on table public.community_replies to authenticated;
grant select, insert, update on table public.submissions to authenticated;
grant select, insert on table public.profiles to authenticated;
grant update (display_name, bio, avatar_path) on table public.profiles to authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

grant select, insert, update, delete on table
  public.courses,
  public.modules,
  public.lessons,
  public.materials,
  public.lesson_progress,
  public.lesson_comments,
  public.community_threads,
  public.community_replies,
  public.submissions,
  public.profiles,
  public.notifications
to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security: every public table created by this migration is enabled
-- ---------------------------------------------------------------------------

alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.materials enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lesson_comments enable row level security;
alter table public.community_threads enable row level security;
alter table public.community_replies enable row level security;
alter table public.submissions enable row level security;
alter table public.profiles enable row level security;
alter table public.notifications enable row level security;

-- Courses -------------------------------------------------------------------

create policy courses_select_authenticated
on public.courses for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy courses_update_staff
on public.courses for update
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
)
with check (
  singleton
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

-- Modules -------------------------------------------------------------------

create policy modules_select_authenticated
on public.modules for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy modules_insert_staff
on public.modules for insert
to authenticated
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy modules_update_staff
on public.modules for update
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
)
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy modules_delete_staff
on public.modules for delete
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

-- Lessons: students never see future publications ---------------------------

create policy lessons_select_visible
on public.lessons for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and published_at <= now()
    )
  )
);

create policy lessons_insert_staff
on public.lessons for insert
to authenticated
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy lessons_update_staff
on public.lessons for update
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
)
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy lessons_delete_staff
on public.lessons for delete
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

-- Materials: students only see material for already-published lessons -------

create policy materials_select_visible
on public.materials for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and exists (
        select 1
        from public.lessons as lesson
        where lesson.id = materials.lesson_id
          and lesson.published_at <= now()
      )
    )
  )
);

create policy materials_insert_staff
on public.materials for insert
to authenticated
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy materials_update_staff
on public.materials for update
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
)
with check (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy materials_delete_staff
on public.materials for delete
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

-- Lesson progress: private to the student who owns it -----------------------

create policy lesson_progress_select_own
on public.lesson_progress for select
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
);

create policy lesson_progress_insert_own_published
on public.lesson_progress for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id = lesson_progress.lesson_id
      and lesson.published_at <= now()
  )
);

create policy lesson_progress_update_own_published
on public.lesson_progress for update
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
)
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id = lesson_progress.lesson_id
      and lesson.published_at <= now()
  )
);

-- Lesson comments -----------------------------------------------------------

create policy lesson_comments_select_visible
on public.lesson_comments for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id = lesson_comments.lesson_id
      and (
        lesson.published_at <= now()
        or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
          in ('professor', 'admin')
      )
  )
);

create policy lesson_comments_insert_own_visible
on public.lesson_comments for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id = lesson_comments.lesson_id
      and (
        lesson.published_at <= now()
        or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
          in ('professor', 'admin')
      )
  )
);

-- Community: any permanent authenticated user can ask and answer ------------

create policy community_threads_select_authenticated
on public.community_threads for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy community_threads_insert_own
on public.community_threads for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy community_replies_select_authenticated
on public.community_replies for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy community_replies_insert_own
on public.community_replies for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and is_staff = (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
  )
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

-- Submissions: staff see all; students see and replace only their own --------

create policy submissions_select_staff_or_own
on public.submissions for select
to authenticated
using (
  coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
  or (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
    and (select auth.uid()) = user_id
  )
);

create policy submissions_insert_own_required_lesson
on public.submissions for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id = submissions.lesson_id
      and lesson.requires_submission
      and lesson.published_at <= now()
  )
);

create policy submissions_update_own_required_lesson
on public.submissions for update
to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
)
with check (
  (select auth.uid()) = user_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id = submissions.lesson_id
      and lesson.requires_submission
      and lesson.published_at <= now()
  )
);

-- Profiles: visible within the organization, editable only by their owner ----

create policy profiles_select_authenticated
on public.profiles for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy profiles_insert_own
on public.profiles for insert
to authenticated
with check (
  (select auth.uid()) = id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy profiles_update_own
on public.profiles for update
to authenticated
using (
  (select auth.uid()) = id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
)
with check (
  (select auth.uid()) = id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

-- Notifications: only the addressed professor/admin can read or mark read ----

create policy notifications_select_recipient_staff
on public.notifications for select
to authenticated
using (
  (select auth.uid()) = recipient_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy notifications_update_recipient_staff
on public.notifications for update
to authenticated
using (
  (select auth.uid()) = recipient_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
)
with check (
  (select auth.uid()) = recipient_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

-- ---------------------------------------------------------------------------
-- Private Storage buckets and object policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'covers',
    'covers',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'avatars',
    'avatars',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'materials',
    'materials',
    false,
    20971520,
    array['application/pdf']
  ),
  (
    'submissions',
    'submissions',
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

-- Covers: authenticated users read; professor/admin manage and can upsert.
create policy covers_select_authenticated
on storage.objects for select
to authenticated
using (
  bucket_id = 'covers'
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy covers_insert_staff
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'covers'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy covers_update_staff
on storage.objects for update
to authenticated
using (
  bucket_id = 'covers'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
)
with check (
  bucket_id = 'covers'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy covers_delete_staff
on storage.objects for delete
to authenticated
using (
  bucket_id = 'covers'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

-- Avatars use: <user_id>/<file>. Everyone in the organization can read them;
-- only the owning user can insert/update/delete. SELECT + INSERT + UPDATE make
-- Storage upsert work instead of silently returning zero rows.
create policy avatars_select_authenticated
on storage.objects for select
to authenticated
using (
  bucket_id = 'avatars'
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy avatars_insert_own
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy avatars_update_own
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy avatars_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

-- Materials are linked by exact storage_path metadata. Staff can manage every
-- object; students can read only a linked PDF whose lesson is already published.
create policy materials_objects_select_visible
on storage.objects for select
to authenticated
using (
  bucket_id = 'materials'
  and (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and exists (
        select 1
        from public.materials as material
        join public.lessons as lesson on lesson.id = material.lesson_id
        where material.storage_path = storage.objects.name
          and lesson.published_at <= now()
      )
    )
  )
);

create policy materials_objects_insert_staff
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'materials'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy materials_objects_update_staff
on storage.objects for update
to authenticated
using (
  bucket_id = 'materials'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
)
with check (
  bucket_id = 'materials'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

create policy materials_objects_delete_staff
on storage.objects for delete
to authenticated
using (
  bucket_id = 'materials'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('professor', 'admin')
);

-- Submissions use: <user_id>/<lesson_id>/<file>. Staff can read all objects.
-- A student can read/upsert only their own object and only while that published
-- lesson requests a submission.
create policy submissions_objects_select_staff_or_own
on storage.objects for select
to authenticated
using (
  bucket_id = 'submissions'
  and (
    coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
    or (
      coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
      and (storage.foldername(name))[1] = (select auth.uid())::text
      and owner_id = (select auth.uid())::text
    )
  )
);

create policy submissions_objects_insert_own_required_lesson
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'submissions'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id::text = (storage.foldername(name))[2]
      and lesson.requires_submission
      and lesson.published_at <= now()
  )
);

create policy submissions_objects_update_own_required_lesson
on storage.objects for update
to authenticated
using (
  bucket_id = 'submissions'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id::text = (storage.foldername(name))[2]
      and lesson.requires_submission
      and lesson.published_at <= now()
  )
)
with check (
  bucket_id = 'submissions'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text
  and exists (
    select 1
    from public.lessons as lesson
    where lesson.id::text = (storage.foldername(name))[2]
      and lesson.requires_submission
      and lesson.published_at <= now()
  )
);

create policy submissions_objects_delete_own
on storage.objects for delete
to authenticated
using (
  bucket_id = 'submissions'
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '') = 'aluno'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text
);

comment on column public.lessons.published_at is
  'Instant when students may see the lesson; authoring UI interprets local input in America/Sao_Paulo.';

comment on column public.lessons.scheduled_for is
  'Calendar date used to group the course timeline; not an event or meeting time.';

comment on column public.community_replies.is_staff is
  'Derived by trigger from auth.jwt().app_metadata.role; clients cannot choose it.';

comment on column public.materials.storage_path is
  'Exact object name inside the private materials bucket.';

comment on column public.submissions.storage_path is
  'Exact object name inside the private submissions bucket; convention user_id/lesson_id/file.';
