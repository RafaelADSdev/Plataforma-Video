grant update (title, body) on table public.community_threads to authenticated;
grant delete on table public.community_threads to authenticated;
grant update (body) on table public.community_replies to authenticated;
grant delete on table public.community_replies to authenticated;
grant delete on table public.community_thread_attachments to authenticated;

-- Authors may edit only their own text. Staff cannot rewrite someone else's post.
create policy community_threads_update_own
on public.community_threads for update
to authenticated
using (
  (select auth.uid()) = author_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
)
with check (
  (select auth.uid()) = author_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

create policy community_replies_update_own
on public.community_replies for update
to authenticated
using (
  (select auth.uid()) = author_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
)
with check (
  (select auth.uid()) = author_id
  and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
    in ('aluno', 'professor', 'admin')
);

-- Authors delete their own posts; professors and admins can remove any post.
create policy community_threads_delete_own_or_staff
on public.community_threads for delete
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    (select auth.uid()) = author_id
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
  )
);

create policy community_replies_delete_own_or_staff
on public.community_replies for delete
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    (select auth.uid()) = author_id
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
  )
);

-- Needed so deleting a thread can cascade attachments even when staff is not the author.
create policy community_thread_attachments_delete_own_or_staff
on public.community_thread_attachments for delete
to authenticated
using (
  coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean), false) = false
  and (
    (select auth.uid()) = author_id
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
    or exists (
      select 1
      from public.community_threads as thread
      where thread.id = community_thread_attachments.thread_id
        and thread.author_id = (select auth.uid())
    )
  )
);

create policy community_objects_delete_own_or_staff
on storage.objects for delete
to authenticated
using (
  bucket_id = 'community'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or coalesce((select auth.jwt() -> 'app_metadata' ->> 'role'), '')
      in ('professor', 'admin')
  )
);
