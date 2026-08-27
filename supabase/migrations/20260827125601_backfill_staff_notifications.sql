-- Notification rows are addressed to each staff account. If a professor/admin
-- is created after student activity, copy the existing activity events into the
-- new inbox so staff accounts have the same classes of notices.

create function private.backfill_staff_notifications_for(target_recipient_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from auth.users as target
    where target.id = target_recipient_id
      and coalesce(target.raw_app_meta_data ->> 'role', '') in ('professor', 'admin')
  ) then
    return;
  end if;

  insert into public.notifications (
    recipient_id,
    actor_id,
    type,
    lesson_id,
    comment_id,
    thread_id,
    submission_id,
    created_at
  )
  select
    target_recipient_id,
    activity.actor_id,
    activity.type,
    activity.lesson_id,
    activity.comment_id,
    activity.thread_id,
    activity.submission_id,
    activity.created_at
  from (
    select
      notification.actor_id,
      notification.type,
      notification.lesson_id,
      notification.comment_id,
      notification.thread_id,
      notification.submission_id,
      notification.created_at
    from public.notifications as notification
    join auth.users as actor on actor.id = notification.actor_id
    where coalesce(actor.raw_app_meta_data ->> 'role', '') = 'aluno'
    group by
      notification.actor_id,
      notification.type,
      notification.lesson_id,
      notification.comment_id,
      notification.thread_id,
      notification.submission_id,
      notification.created_at
  ) as activity
  where not exists (
    select 1
    from public.notifications as existing
    where existing.recipient_id = target_recipient_id
      and existing.actor_id is not distinct from activity.actor_id
      and existing.type = activity.type
      and existing.lesson_id is not distinct from activity.lesson_id
      and existing.comment_id is not distinct from activity.comment_id
      and existing.thread_id is not distinct from activity.thread_id
      and existing.submission_id is not distinct from activity.submission_id
      and existing.created_at = activity.created_at
  );
end;
$$;

create function private.backfill_notifications_when_user_becomes_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_role text := coalesce(new.raw_app_meta_data ->> 'role', '');
  old_role text := case
    when tg_op = 'UPDATE' then coalesce(old.raw_app_meta_data ->> 'role', '')
    else ''
  end;
begin
  if new_role in ('professor', 'admin')
    and old_role not in ('professor', 'admin') then
    perform private.backfill_staff_notifications_for(new.id);
  end if;

  return new;
end;
$$;

create trigger auth_users_backfill_staff_notifications
after insert or update of raw_app_meta_data on auth.users
for each row execute function private.backfill_notifications_when_user_becomes_staff();

-- Repair staff accounts that already existed when this migration was applied.
select private.backfill_staff_notifications_for(staff.id)
from auth.users as staff
where coalesce(staff.raw_app_meta_data ->> 'role', '') in ('professor', 'admin');

revoke all on function private.backfill_staff_notifications_for(uuid)
from public, anon, authenticated;

revoke all on function private.backfill_notifications_when_user_becomes_staff()
from public, anon, authenticated;
