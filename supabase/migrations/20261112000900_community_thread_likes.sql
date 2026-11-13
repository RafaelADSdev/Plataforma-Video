alter table public.community_threads
  add column like_count integer not null default 0 check (like_count >= 0);

-- Existing thread fields remain writable on insert. The counter is database-managed.
revoke insert on table public.community_threads from authenticated;
grant insert (id, course_id, author_id, title, body, created_at)
  on table public.community_threads to authenticated;

create index community_threads_like_rank_idx
  on public.community_threads (like_count desc, created_at desc, id);

create table public.community_thread_likes (
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (thread_id, user_id)
);

create index community_thread_likes_user_idx on public.community_thread_likes (user_id);

alter table public.community_thread_likes enable row level security;
revoke all on table public.community_thread_likes from public, anon, authenticated;
grant select, insert, delete on table public.community_thread_likes to authenticated;

create policy community_thread_likes_own
on public.community_thread_likes for all
to authenticated
using (
  user_id = (select auth.uid())
  and exists (select 1 from public.community_threads as thread where thread.id = thread_id)
);

create function private.sync_community_thread_like_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.community_threads
    set like_count = like_count + 1
    where id = new.thread_id;
  else
    update public.community_threads
    set like_count = like_count - 1
    where id = old.thread_id;
  end if;
  return null;
end;
$$;

revoke all on function private.sync_community_thread_like_count() from public, anon, authenticated;

create trigger community_thread_likes_sync_count
after insert or delete on public.community_thread_likes
for each row execute function private.sync_community_thread_like_count();
