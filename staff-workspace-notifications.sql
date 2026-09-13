-- Apply after staff-workspace-setup.sql and owner seed. No push is delivered
-- until staff-push Edge Function, VAPID keys, and scheduler are configured.

create schema if not exists staff_private;
revoke all on schema staff_private from public, anon, authenticated;

alter table public.staff_members add column if not exists handle text unique
  check (handle ~ '^[a-z0-9_]{2,32}$');
update public.staff_members set handle = 'momotors' where role = 'owner' and handle is null
  and user_id = (select id from auth.users where email = 'momotorswpg@gmail.com' limit 1);

alter table public.staff_messages add column if not exists reply_to uuid references public.staff_messages(id);

create table if not exists public.staff_follows (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  channel text not null check (channel in ('owner_vehicle','sales_vehicle','owner_group','sales_group')),
  vehicle_id bigint references public."Vehicles"(id) on delete cascade,
  following boolean not null default true,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  check ((channel in ('owner_vehicle','sales_vehicle')) = (vehicle_id is not null))
);
create unique index if not exists staff_follows_one_per_space on public.staff_follows(user_id,channel,coalesce(vehicle_id,0));

create table if not exists public.staff_notification_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ready_alerts boolean not null default true
);

create table if not exists public.staff_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('mention','reply','ready')),
  message_id uuid references public.staff_messages(id) on delete cascade,
  vehicle_id bigint references public."Vehicles"(id) on delete cascade,
  channel text,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  push_processing_at timestamptz,
  push_sent_at timestamptz
);
create index if not exists staff_notifications_inbox on public.staff_notifications(user_id,created_at desc);
create index if not exists staff_notifications_push_queue on public.staff_notifications(created_at)
  where push_sent_at is null;
create unique index if not exists staff_notifications_one_message_alert on public.staff_notifications(user_id,message_id)
  where message_id is not null;

create table if not exists public.staff_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now()
);

alter table public.staff_follows enable row level security;
alter table public.staff_notification_settings enable row level security;
alter table public.staff_notifications enable row level security;
alter table public.staff_push_subscriptions enable row level security;
revoke all on public.staff_follows, public.staff_notification_settings,
  public.staff_notifications, public.staff_push_subscriptions from anon;
grant select,insert,update,delete on public.staff_follows, public.staff_push_subscriptions to authenticated;
grant select,insert,update on public.staff_notification_settings to authenticated;
grant select on public.staff_notifications to authenticated;
grant update(read_at) on public.staff_notifications to authenticated;

create policy "Staff read own follows" on public.staff_follows for select to authenticated
  using (user_id = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and
        (channel = 'sales_group' or (channel = 'sales_vehicle' and exists
          (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_follows.vehicle_id and s.ready_for_sale)))))));
create policy "Staff add allowed follows" on public.staff_follows for insert to authenticated
  with check (user_id = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and
        (channel = 'sales_group' or (channel = 'sales_vehicle' and exists
          (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_follows.vehicle_id and s.ready_for_sale)))))));
create policy "Staff update own follows" on public.staff_follows for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and
        (channel = 'sales_group' or (channel = 'sales_vehicle' and exists
          (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_follows.vehicle_id and s.ready_for_sale)))))));
create policy "Staff delete own follows" on public.staff_follows for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Staff read own notification settings" on public.staff_notification_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Staff add own notification settings" on public.staff_notification_settings for insert to authenticated
  with check (user_id = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid())));
create policy "Staff update own notification settings" on public.staff_notification_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Staff read own notifications" on public.staff_notifications for select to authenticated
  using (user_id = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and
        (kind = 'ready' or channel = 'sales_group' or
          (channel = 'sales_vehicle' and exists
            (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_notifications.vehicle_id and s.ready_for_sale)))))));
create policy "Staff mark own notifications read" on public.staff_notifications for update to authenticated
  using (user_id = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and
        (kind = 'ready' or channel = 'sales_group' or
          (channel = 'sales_vehicle' and exists
            (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_notifications.vehicle_id and s.ready_for_sale)))))))
  with check (user_id = (select auth.uid()));

create policy "Staff read own push subscriptions" on public.staff_push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Staff add own push subscriptions" on public.staff_push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid())));
create policy "Staff update own push subscriptions" on public.staff_push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Staff delete own push subscriptions" on public.staff_push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- The trigger runs as the caller and checks replies against rows they can see.
create function staff_private.validate_reply() returns trigger language plpgsql security invoker
set search_path = pg_catalog, public as $$
begin
  if new.reply_to is not null and not exists
    (select 1 from public.staff_messages msg where msg.id = new.reply_to
      and msg.channel = new.channel and msg.vehicle_id is not distinct from new.vehicle_id)
  then raise exception 'Reply must be to a message in this conversation'; end if;
  return new;
end $$;
revoke all on function staff_private.validate_reply() from public, anon, authenticated;
create trigger staff_validate_reply before insert on public.staff_messages
  for each row execute function staff_private.validate_reply();

-- SECURITY DEFINER is limited to these non-exposed trigger functions. They
-- only enqueue alerts for explicit staff members who can access the space.
create function staff_private.queue_message_alerts() returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
begin
  -- Posting follows the conversation unless its author already muted it.
  insert into public.staff_follows(user_id,channel,vehicle_id)
  values(new.author_id,new.channel,new.vehicle_id)
  on conflict do nothing;

  insert into public.staff_notifications(user_id,kind,message_id,vehicle_id,channel,title,body)
  select m.user_id,'mention',new.id,new.vehicle_id,new.channel,
    'You were mentioned',left(new.author_name || ': ' || new.body,180)
  from public.staff_members m
  where m.user_id <> new.author_id and m.handle is not null
    and lower(new.body) ~ ('(^|[^a-z0-9_])@' || m.handle || '([^a-z0-9_]|$)')
    and (m.role = 'owner' or (m.role = 'sales' and
      (new.channel = 'sales_group' or (new.channel = 'sales_vehicle' and exists
        (select 1 from public.staff_vehicle_state s where s.vehicle_id = new.vehicle_id and s.ready_for_sale)))))
    and not exists (select 1 from public.staff_follows f where f.user_id=m.user_id
      and f.channel=new.channel and f.vehicle_id is not distinct from new.vehicle_id and f.muted);

  if new.reply_to is not null then
    insert into public.staff_notifications(user_id,kind,message_id,vehicle_id,channel,title,body)
    select f.user_id,'reply',new.id,new.vehicle_id,new.channel,
      'Reply in a followed conversation',left(new.author_name || ': ' || new.body,180)
    from public.staff_follows f join public.staff_members m on m.user_id=f.user_id
    where f.channel=new.channel and f.vehicle_id is not distinct from new.vehicle_id
      and f.following and not f.muted and f.user_id <> new.author_id
      and (m.role = 'owner' or (m.role = 'sales' and
        (new.channel = 'sales_group' or (new.channel = 'sales_vehicle' and exists
          (select 1 from public.staff_vehicle_state s where s.vehicle_id = new.vehicle_id and s.ready_for_sale)))))
      and not exists (select 1 from public.staff_notifications n where n.user_id=f.user_id and n.message_id=new.id);
  end if;
  return new;
end $$;
revoke all on function staff_private.queue_message_alerts() from public, anon, authenticated;
create trigger staff_queue_message_alerts after insert on public.staff_messages
  for each row execute function staff_private.queue_message_alerts();

create function staff_private.queue_ready_alerts() returns trigger language plpgsql security definer
set search_path = pg_catalog, public as $$
begin
  if new.ready_for_sale and (tg_op = 'INSERT' or not old.ready_for_sale) then
    insert into public.staff_notifications(user_id,kind,vehicle_id,channel,title,body)
    select m.user_id,'ready',new.vehicle_id,'sales_vehicle','Vehicle ready for sale',
      coalesce(v."Year"::text || ' ','') || coalesce(v."Make" || ' ','') || coalesce(v."Model",'Vehicle')
    from public.staff_members m join public."Vehicles" v on v.id=new.vehicle_id
    left join public.staff_notification_settings prefs on prefs.user_id=m.user_id
    where m.role='sales' and m.user_id is distinct from new.ready_by
      and coalesce(prefs.ready_alerts,true)
    on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function staff_private.queue_ready_alerts() from public, anon, authenticated;
create trigger staff_queue_ready_alerts after insert or update of ready_for_sale on public.staff_vehicle_state
  for each row execute function staff_private.queue_ready_alerts();
