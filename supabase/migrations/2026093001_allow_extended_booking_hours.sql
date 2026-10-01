alter table public.booking_weekly_availability
  drop constraint if exists booking_weekly_availability_hours;

alter table public.booking_weekly_availability
  add constraint booking_weekly_availability_hours
  check (booking_start < booking_end);
