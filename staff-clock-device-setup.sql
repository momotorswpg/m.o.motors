alter table public.employee_timesheets
  add column if not exists clock_in_ip text,
  add column if not exists clock_out_ip text,
  add column if not exists clock_in_user_agent text,
  add column if not exists clock_out_user_agent text,
  add column if not exists clock_in_device_id uuid,
  add column if not exists clock_out_device_id uuid;

create table if not exists public.office_clock_devices (
  id uuid primary key default gen_random_uuid(),
  device_hash text not null unique,
  label text not null,
  active boolean not null default true,
  approved_by uuid not null references public.staff_members(user_id),
  approved_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_seen_ip text,
  last_seen_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Edge Functions use the service role after validating the signed-in user.
-- Explicit grants are required because the staff tables intentionally revoke
-- ordinary write access.
grant select, insert, update, delete on table public.staff_members to service_role;
grant select, insert, update, delete on table public.employee_timesheets to service_role;
grant select, insert, update, delete on table public.office_clock_devices to service_role;
grant usage on schema private to service_role;
grant execute on function private.is_admin() to service_role;

alter table public.employee_timesheets
  drop constraint if exists employee_timesheets_clock_in_device_id_fkey,
  add constraint employee_timesheets_clock_in_device_id_fkey foreign key (clock_in_device_id) references public.office_clock_devices(id) on delete set null,
  drop constraint if exists employee_timesheets_clock_out_device_id_fkey,
  add constraint employee_timesheets_clock_out_device_id_fkey foreign key (clock_out_device_id) references public.office_clock_devices(id) on delete set null;

create index if not exists employee_timesheets_clock_in_device_idx on public.employee_timesheets(clock_in_device_id);
create index if not exists employee_timesheets_clock_out_device_idx on public.employee_timesheets(clock_out_device_id);
create index if not exists office_clock_devices_approved_by_idx on public.office_clock_devices(approved_by);

alter table public.office_clock_devices enable row level security;
grant select on table public.office_clock_devices to authenticated;
revoke insert, update, delete on table public.office_clock_devices from authenticated;

drop policy if exists "Admins read office clock devices" on public.office_clock_devices;
create policy "Admins read office clock devices" on public.office_clock_devices
for select to authenticated using ((select private.is_admin()));

drop policy if exists "Employees clock themselves in" on public.employee_timesheets;
drop policy if exists "Employees clock themselves out" on public.employee_timesheets;
drop policy if exists "Admins insert timesheets" on public.employee_timesheets;
drop policy if exists "Admins update timesheets" on public.employee_timesheets;
create policy "Admins insert timesheets" on public.employee_timesheets
for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update timesheets" on public.employee_timesheets
for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function private.protect_employee_time_entry()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'service_role' or (select private.is_admin()) then
    new.updated_at := now();
    return new;
  end if;
  raise exception 'Clock actions must use an approved office device';
end;
$$;
