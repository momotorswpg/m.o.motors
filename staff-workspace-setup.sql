-- Run this on the M.O. Motors Supabase project before enabling staff.html.
-- Add users to staff_members with a trusted admin/SQL session after creating
-- their Supabase Auth accounts. Never let clients set their own role.

create table if not exists public.staff_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  role text not null check (role in ('owner', 'sales')),
  created_at timestamptz not null default now()
);

create table if not exists public.staff_vehicle_state (
  vehicle_id bigint primary key references public."Vehicles"(id) on delete cascade,
  ready_for_sale boolean not null default false,
  ready_at timestamptz,
  ready_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.staff_messages (
  id uuid primary key default gen_random_uuid(),
  vehicle_id bigint references public."Vehicles"(id) on delete cascade,
  channel text not null check (channel in ('owner_vehicle','sales_vehicle','owner_group','sales_group')),
  author_id uuid not null default auth.uid() references auth.users(id),
  author_name text not null,
  body text not null check (length(trim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  check ((channel in ('owner_vehicle','sales_vehicle')) = (vehicle_id is not null))
);

create table if not exists public.staff_expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id bigint not null references public."Vehicles"(id) on delete cascade,
  kind text not null check (kind in ('purchase','repair','transport','other')),
  description text not null check (length(trim(description)) between 1 and 500),
  amount numeric(12,2) not null check (amount >= 0),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.staff_sales_activity (
  id uuid primary key default gen_random_uuid(),
  vehicle_id bigint not null references public."Vehicles"(id) on delete cascade,
  kind text not null check (kind in ('inquiry','appointment','test_drive','sale','note')),
  details text not null check (length(trim(details)) between 1 and 1000),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.staff_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.staff_messages(id) on delete cascade,
  object_path text not null unique,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists staff_messages_vehicle_channel_time on public.staff_messages(vehicle_id,channel,created_at);
create index if not exists staff_messages_group_time on public.staff_messages(channel,created_at) where vehicle_id is null;
create index if not exists staff_expenses_vehicle_time on public.staff_expenses(vehicle_id,created_at);
create index if not exists staff_activity_vehicle_time on public.staff_sales_activity(vehicle_id,created_at);

alter table public.staff_members enable row level security;
alter table public.staff_vehicle_state enable row level security;
alter table public.staff_messages enable row level security;
alter table public.staff_expenses enable row level security;
alter table public.staff_sales_activity enable row level security;
alter table public.staff_attachments enable row level security;

revoke all on public.staff_members, public.staff_vehicle_state, public.staff_messages,
  public.staff_expenses, public.staff_sales_activity, public.staff_attachments from anon;
revoke all on public.staff_members from authenticated;
grant select on public.staff_members to authenticated;
grant select, insert, update on public.staff_vehicle_state to authenticated;
grant select, insert on public.staff_messages, public.staff_expenses,
  public.staff_sales_activity, public.staff_attachments to authenticated;

create policy "Staff read own membership" on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners see states; sales see ready states" on public.staff_vehicle_state for select to authenticated
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid())
    and (m.role = 'owner' or (m.role = 'sales' and ready_for_sale))));
create policy "Owners create vehicle states" on public.staff_vehicle_state for insert to authenticated
  with check (ready_by = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
create policy "Owners update vehicle states" on public.staff_vehicle_state for update to authenticated
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (ready_by = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "Staff read allowed messages" on public.staff_messages for select to authenticated
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
    (m.role = 'owner' or (m.role = 'sales' and
      (channel = 'sales_group' or (channel = 'sales_vehicle' and exists
        (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_messages.vehicle_id and s.ready_for_sale)))))));
create policy "Staff send allowed messages" on public.staff_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and author_name =
    (select m.display_name from public.staff_members m where m.user_id = (select auth.uid())) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and
        (channel = 'sales_group' or (channel = 'sales_vehicle' and exists
          (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_messages.vehicle_id and s.ready_for_sale)))))));

create policy "Owners read expenses" on public.staff_expenses for select to authenticated
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
create policy "Owners add expenses" on public.staff_expenses for insert to authenticated
  with check (created_by = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));

create policy "Staff read ready sales activity" on public.staff_sales_activity for select to authenticated
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
    (m.role = 'owner' or (m.role = 'sales' and exists
      (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_sales_activity.vehicle_id and s.ready_for_sale)))));
create policy "Staff add ready sales activity" on public.staff_sales_activity for insert to authenticated
  with check (created_by = (select auth.uid()) and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and exists
        (select 1 from public.staff_vehicle_state s where s.vehicle_id = staff_sales_activity.vehicle_id and s.ready_for_sale)))));

create policy "Staff read allowed attachments" on public.staff_attachments for select to authenticated
  using (exists (select 1 from public.staff_messages msg where msg.id = message_id));
create policy "Staff attach own messages" on public.staff_attachments for insert to authenticated
  with check (uploaded_by = (select auth.uid()) and exists
    (select 1 from public.staff_messages msg where msg.id = message_id and msg.author_id = (select auth.uid())
      and object_path like msg.channel || '/' || coalesce(msg.vehicle_id::text,'group') || '/%'));

-- Create a PRIVATE bucket named staff-private in Supabase Storage before uploads.
-- Do not use the existing public vehicle-images bucket for internal photos.
create policy "Staff read allowed private photos" on storage.objects for select to authenticated
  using (bucket_id = 'staff-private' and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and
        (split_part(name,'/',1) = 'sales_group' or
          (split_part(name,'/',1) = 'sales_vehicle' and exists
            (select 1 from public.staff_vehicle_state s where s.vehicle_id::text = split_part(name,'/',2) and s.ready_for_sale)))))));
create policy "Staff upload allowed private photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'staff-private' and split_part(name,'/',3) <> '' and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and
      (m.role = 'owner' or (m.role = 'sales' and
        (split_part(name,'/',1) = 'sales_group' or
          (split_part(name,'/',1) = 'sales_vehicle' and exists
            (select 1 from public.staff_vehicle_state s where s.vehicle_id::text = split_part(name,'/',2) and s.ready_for_sale)))))));

-- Before adding a sales Auth user, apply staff-workspace-admin-hardening.sql too.
