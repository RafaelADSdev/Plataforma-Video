alter table public.lessons add column youtube_video_id text
  check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$');

grant insert (youtube_video_id), update (youtube_video_id) on public.lessons to authenticated;

create or replace function private.require_ready_recording_for_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.published_at is not distinct from old.published_at then return new; end if;
  end if;
  if new.published_at is not null and new.youtube_video_id is null
    and new.video_status not in ('none', 'ready') then
    raise exception 'Espere a gravação ficar pronta antes de publicar ou agendar.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.normalize_lesson_comment_timestamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.lessons
    where id = new.lesson_id and (video_status = 'ready' or youtube_video_id is not null)
  ) then
    new.t_seconds := null;
  end if;
  return new;
end;
$$;
