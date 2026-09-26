-- Employee schedules and time-off requests for the M.O Motors admin workspace.

create table if not exists public.employee_schedules (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.staff_members(user_id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  valid_from date not null,
  valid_until date not null,
  note text,
  created_by uuid not null default auth.uid() references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check (valid_until >= valid_from),
  unique (employee_id, weekday, start_time, end_time, valid_from, valid_until)
);

create table if not exists public.employee_time_off (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.staff_members(user_id) on delete cascade,
  start_date date not null,
  end_date date not null,
  request_type text not null default 'time_off' check (request_type in ('vacation', 'time_off', 'sick')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  notes text,
  created_by uuid not null default auth.uid() references public.staff_members(user_id),
  reviewed_by uuid references public.staff_members(user_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists employee_schedules_employee_date_idx on public.employee_schedules(employee_id, valid_from, valid_until);
create index if not exists employee_time_off_employee_date_idx on public.employee_time_off(employee_id, start_date, end_date);

alter table public.employee_schedules enable row level security;
alter table public.employee_time_off enable row level security;

grant select, insert, update, delete on public.employee_schedules to authenticated;
grant select, insert, update, delete on public.employee_time_off to authenticated;

drop policy if exists "Staff read permitted schedules" on public.employee_schedules;
drop policy if exists "Admins insert schedules" on public.employee_schedules;
drop policy if exists "Admins update schedules" on public.employee_schedules;
drop policy if exists "Admins delete schedules" on public.employee_schedules;
create policy "Staff read permitted schedules" on public.employee_schedules for select to authenticated
using (employee_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins insert schedules" on public.employee_schedules for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins update schedules" on public.employee_schedules for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete schedules" on public.employee_schedules for delete to authenticated
using ((select private.is_admin()));

drop policy if exists "Staff read permitted time off" on public.employee_time_off;
drop policy if exists "Staff request own time off" on public.employee_time_off;
drop policy if exists "Admins insert time off" on public.employee_time_off;
drop policy if exists "Admins update time off" on public.employee_time_off;
drop policy if exists "Admins delete time off" on public.employee_time_off;
create policy "Staff read permitted time off" on public.employee_time_off for select to authenticated
using (employee_id = (select auth.uid()) or (select private.is_admin()));
create policy "Staff request own time off" on public.employee_time_off for insert to authenticated
with check (employee_id = (select auth.uid()) and created_by = (select auth.uid()) and status = 'pending');
create policy "Admins insert time off" on public.employee_time_off for insert to authenticated
with check ((select private.is_admin()));
create policy "Admins update time off" on public.employee_time_off for update to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete time off" on public.employee_time_off for delete to authenticated
using ((select private.is_admin()));

insert into public.employee_schedules (employee_id, weekday, start_time, end_time, valid_from, valid_until, note, created_by)
select employee.user_id, shift.weekday, shift.start_time, shift.end_time, date '2026-09-09', date '2026-12-11', 'Fall school-term schedule · 30-minute travel allowance included', owner.user_id
from public.staff_members employee
cross join (values
  (1, time '16:00', time '18:00'),
  (2, time '12:00', time '18:00'),
  (3, time '16:00', time '18:00'),
  (4, time '12:00', time '18:00'),
  (5, time '16:00', time '18:00'),
  (6, time '12:00', time '18:00')
) as shift(weekday, start_time, end_time)
cross join lateral (
  select user_id from public.staff_members where role = 'owner' and active = true order by user_id limit 1
) owner
where lower(employee.email) = 'zuhayrrsamin@gmail.com'
on conflict (employee_id, weekday, start_time, end_time, valid_from, valid_until) do nothing;
