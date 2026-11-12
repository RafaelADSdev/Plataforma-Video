alter table public.lessons alter column published_at drop not null;
alter table public.lessons alter column published_at drop default;
alter table public.lessons add column video_status text not null default 'none'
  check (video_status in ('none', 'migration_required', 'uploading', 'processing', 'failed', 'ready'));

-- Only the server can reserve an upload, promote a ready recording or read
-- an original link. No video identifiers or upload URLs live on lessons.
create table public.lesson_media (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  legacy_youtube_url text,
  stream_uid text unique check (stream_uid ~ '^[a-f0-9]{32}$'),
  pending_uid text unique check (pending_uid ~ '^[a-f0-9]{32}$'),
  upload_id uuid,
  upload_fingerprint text check (upload_fingerprint ~ '^[a-f0-9]{64}$'),
  upload_url text,
  upload_expires_at timestamptz,
  upload_state text check (upload_state in ('uploading', 'processing', 'failed')),
  check (
    (upload_id is null and upload_state is null and pending_uid is null and upload_url is null
      and upload_fingerprint is null and upload_expires_at is null)
    or (upload_id is not null and upload_state is not null
      and upload_fingerprint is not null and upload_expires_at is not null
      and (upload_url is null or pending_uid is not null))
  )
);
alter table public.lesson_media enable row level security;
revoke all on public.lesson_media from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.lesson_media to service_role;

create function private.sync_lesson_video_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_status text;
begin
  if tg_op = 'DELETE' then
    update public.lessons set video_status = 'none' where id = old.lesson_id;
    return old;
  end if;
  next_status := case
    when new.stream_uid is not null then 'ready'
    when new.upload_state is not null then new.upload_state
    when new.legacy_youtube_url is not null then 'migration_required'
    else 'none'
  end;
  update public.lessons set video_status = next_status
    where id = new.lesson_id and video_status is distinct from next_status;
  return new;
end;
$$;

create trigger lesson_media_sync_status after insert or update or delete on public.lesson_media
for each row execute function private.sync_lesson_video_status();

insert into public.lesson_media (lesson_id, legacy_youtube_url)
select id, youtube_url from public.lessons where youtube_url is not null;

create or replace function private.normalize_lesson_comment_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.lessons where id = new.lesson_id and video_status = 'ready'
  ) then
    new.t_seconds := null;
  end if;
  return new;
end;
$$;

alter table public.lessons drop column youtube_url;
revoke insert, update on public.lessons from authenticated;
grant insert (id, module_id, title, content, published_at, scheduled_for) on public.lessons to authenticated;
grant update (module_id, title, content, published_at, scheduled_for) on public.lessons to authenticated;

create function private.require_ready_recording_for_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.published_at is not distinct from old.published_at then return new; end if;
  end if;
  if new.published_at is not null and new.video_status not in ('none', 'ready') then
    raise exception 'Espere a gravação ficar pronta antes de publicar ou agendar.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger lessons_recording_ready before insert or update of published_at on public.lessons
for each row execute function private.require_ready_recording_for_publication();

revoke all on function private.sync_lesson_video_status(), private.require_ready_recording_for_publication() from public, anon, authenticated;

create function public.save_lesson_progress(p_lesson_id uuid, p_seconds integer, p_watched boolean, p_manual boolean)
returns boolean
language sql
set search_path = ''
as $$
  insert into public.lesson_progress (lesson_id, user_id, last_seconds, watched)
  values (p_lesson_id, auth.uid(), p_seconds, p_watched)
  on conflict (lesson_id, user_id) do update set
    last_seconds = excluded.last_seconds,
    watched = case when p_manual then excluded.watched else lesson_progress.watched or excluded.watched end
  returning watched
$$;

revoke all on function public.save_lesson_progress(uuid, integer, boolean, boolean) from public, anon, authenticated;
grant execute on function public.save_lesson_progress(uuid, integer, boolean, boolean) to authenticated;
