alter table public.test_drive_bookings
  alter column last_name drop not null,
  alter column phone drop not null,
  alter column email drop not null;

drop index if exists public.test_drive_bookings_vehicle_active_slot_unique;

create unique index if not exists test_drive_bookings_active_slot_unique
  on public.test_drive_bookings (preferred_date, preferred_time)
  where lower(coalesce(status, '')) <> 'cancelled';

create index if not exists test_drive_bookings_vehicle_id_idx
  on public.test_drive_bookings (vehicle_id);

create table if not exists public.booking_settings (
  id smallint primary key default 1 check (id = 1),
  booking_start time without time zone not null default '12:00',
  booking_end time without time zone not null default '18:00',
  slot_minutes smallint not null default 30 check (slot_minutes in (15, 30, 60)),
  updated_at timestamp with time zone not null default now(),
  updated_by uuid references public.staff_members(user_id),
  constraint booking_settings_open_hours check (
    booking_start >= time '12:00'
    and booking_end <= time '18:00'
    and booking_start < booking_end
  )
);

create index if not exists booking_settings_updated_by_idx
  on public.booking_settings (updated_by);

insert into public.booking_settings (id, booking_start, booking_end, slot_minutes)
values (1, '12:00', '18:00', 30)
on conflict (id) do nothing;

alter table public.booking_settings enable row level security;

revoke all on public.booking_settings from anon, authenticated;
grant select on public.booking_settings to anon, authenticated;
grant update on public.booking_settings to authenticated;

drop policy if exists "Public can read booking settings" on public.booking_settings;
create policy "Public can read booking settings"
  on public.booking_settings for select
  to anon, authenticated
  using (id = 1);

drop policy if exists "Admins can update booking settings" on public.booking_settings;
create policy "Admins can update booking settings"
  on public.booking_settings for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()) and id = 1);

create or replace function public.get_test_drive_booked_times(p_date date)
returns table(preferred_time text)
language sql
security definer
set search_path = ''
as $$
  select b.preferred_time
  from public.test_drive_bookings b
  where b.preferred_date = p_date
    and lower(coalesce(b.status, '')) <> 'cancelled'
  order by b.preferred_time;
$$;

grant execute on function public.get_test_drive_booked_times(date) to anon, authenticated;

drop function if exists public.get_test_drive_booked_times(bigint, date);
