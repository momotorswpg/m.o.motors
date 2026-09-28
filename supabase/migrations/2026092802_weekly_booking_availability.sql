create table if not exists public.booking_weekly_availability (
  weekday smallint primary key check (weekday between 0 and 6),
  is_open boolean not null default true,
  booking_start time without time zone not null default '12:00',
  booking_end time without time zone not null default '18:00',
  slot_minutes smallint not null default 30 check (slot_minutes in (15, 30, 60)),
  updated_at timestamp with time zone not null default now(),
  updated_by uuid references public.staff_members(user_id),
  constraint booking_weekly_availability_hours check (
    booking_start >= time '12:00'
    and booking_end <= time '18:00'
    and booking_start < booking_end
  )
);

create index if not exists booking_weekly_availability_updated_by_idx
  on public.booking_weekly_availability (updated_by);

insert into public.booking_weekly_availability
  (weekday, is_open, booking_start, booking_end, slot_minutes)
values
  (0, false, '12:00', '18:00', 30),
  (1, true,  '12:00', '18:00', 30),
  (2, true,  '12:00', '18:00', 30),
  (3, true,  '12:00', '18:00', 30),
  (4, true,  '12:00', '18:00', 30),
  (5, true,  '12:00', '18:00', 30),
  (6, true,  '12:00', '18:00', 30)
on conflict (weekday) do nothing;

alter table public.booking_weekly_availability enable row level security;

revoke all on public.booking_weekly_availability from anon, authenticated;
grant select on public.booking_weekly_availability to anon, authenticated;
grant update on public.booking_weekly_availability to authenticated;

create policy "Public can read weekly booking availability"
  on public.booking_weekly_availability for select
  to anon, authenticated
  using (true);

create policy "Admins can update weekly booking availability"
  on public.booking_weekly_availability for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
