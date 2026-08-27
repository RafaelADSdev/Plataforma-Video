create table public.community_thread_attachments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint community_thread_attachments_storage_path_unique unique (storage_path),
  constraint community_thread_attachments_storage_path_check check (
    char_length(btrim(storage_path)) > 0
  ),
  constraint community_thread_attachments_file_name_check check (
    char_length(btrim(file_name)) between 1 and 255
    and lower(file_name) ~ '[.](jpe?g|png|webp|pdf|docx?|xlsx?|pptx?|txt)$'
  ),
  constraint community_thread_attachments_mime_type_check check (
    lower(mime_type) in (
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    )
  ),
  constraint community_thread_attachments_size_check check (
    size_bytes is null or size_bytes between 1 and 20971520
  )
);

create index community_thread_attachments_thread_idx
  on public.community_thread_attachments (thread_id, created_at);

create function private.enforce_community_attachment_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.community_thread_attachments as attachment
    where attachment.thread_id = new.thread_id
  ) >= 5 then
    raise exception 'Cada dúvida aceita no máximo 5 anexos.';
  end if;
  return new;
end;
$$;

create trigger community_thread_attachments_limit
before insert on public.community_thread_attachments
for each row execute function private.enforce_community_attachment_limit();

revoke all on table public.community_thread_attachments from anon, authenticated, service_role;
grant select, insert on table public.community_thread_attachments to authenticated;
grant select, insert, update, delete on table public.community_thread_attachments to service_role;

alter table public.community_thread_attachments enable row level security;

create policy community_thread_attachments_select_authenticated
on public.community_thread_attachments for select
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy community_thread_attachments_insert_own_thread
on public.community_thread_attachments for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
  and exists (
    select 1
    from public.community_threads as thread
    where thread.id = community_thread_attachments.thread_id
      and thread.author_id = (select auth.uid())
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'community',
  'community',
  false,
  20971520,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: <user_id>/<thread_id>/<file>. The whole class can read; only the
-- author of that doubt can upload into their own folder.
create policy community_objects_select_authenticated
on storage.objects for select
to authenticated
using (
  bucket_id = 'community'
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy community_objects_insert_own_thread
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'community'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
  and exists (
    select 1
    from public.community_threads as thread
    where thread.id::text = (storage.foldername(name))[2]
      and thread.author_id = (select auth.uid())
  )
);

comment on table public.community_thread_attachments is
  'Optional files attached to a community doubt; stored in the private community bucket.';

comment on column public.community_thread_attachments.storage_path is
  'Exact object name inside the private community bucket; convention user_id/thread_id/file.';
