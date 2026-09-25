-- M.O Motors role-based admin workspace and payroll foundation.
-- Apply through Supabase migrations. Existing public website access is preserved.

create schema if not exists private;

alter table public.staff_members
  add column if not exists email text,
  add column if not exists active boolean not null default true,
  add column if not exists hourly_wage numeric(10,2) not null default 0 check (hourly_wage >= 0),
  add column if not exists updated_at timestamptz not null default now();

alter table public.staff_members drop constraint if exists staff_members_role_check;
alter table public.staff_members add constraint staff_members_role_check check (role in ('owner', 'admin', 'sales'));

update public.staff_members sm
set email = u.email
from auth.users u
where sm.user_id = u.id and sm.email is null;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = (select auth.uid()) and active = true
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_members
    where user_id = (select auth.uid()) and active = true and role in ('owner', 'admin')
  );
$$;

revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;

create table if not exists public.employee_timesheets (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.staff_members(user_id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes between 0 and 1440),
  notes text,
  adjusted_by uuid references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out is null or clock_out >= clock_in)
);

create unique index if not exists employee_timesheets_one_open_shift
  on public.employee_timesheets(employee_id) where clock_out is null;
create index if not exists employee_timesheets_employee_clock_idx
  on public.employee_timesheets(employee_id, clock_in desc);
create index if not exists employee_timesheets_adjusted_by_idx
  on public.employee_timesheets(adjusted_by);

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

drop trigger if exists protect_employee_time_entry on public.employee_timesheets;
create trigger protect_employee_time_entry
before insert or update on public.employee_timesheets
for each row execute function private.protect_employee_time_entry();

create table if not exists public.employee_commissions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.staff_members(user_id) on delete cascade,
  earned_on date not null default current_date,
  description text not null,
  amount numeric(10,2) not null check (amount >= 0),
  vehicle_id bigint references public."Vehicles"(id) on delete set null,
  created_by uuid not null default auth.uid() references public.staff_members(user_id),
  created_at timestamptz not null default now()
);
create index if not exists employee_commissions_employee_date_idx
  on public.employee_commissions(employee_id, earned_on desc);
create index if not exists employee_commissions_created_by_idx
  on public.employee_commissions(created_by);
create index if not exists employee_commissions_vehicle_idx
  on public.employee_commissions(vehicle_id);

create table if not exists public.pay_stubs (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.staff_members(user_id) on delete cascade,
  period_start date not null,
  period_end date not null,
  regular_hours numeric(8,2) not null default 0 check (regular_hours >= 0),
  hourly_wage numeric(10,2) not null default 0 check (hourly_wage >= 0),
  hourly_earnings numeric(10,2) not null default 0 check (hourly_earnings >= 0),
  commission_earnings numeric(10,2) not null default 0 check (commission_earnings >= 0),
  other_earnings numeric(10,2) not null default 0 check (other_earnings >= 0),
  deductions numeric(10,2) not null default 0 check (deductions >= 0),
  gross_pay numeric(10,2) not null default 0 check (gross_pay >= 0),
  net_pay numeric(10,2) not null default 0,
  notes text,
  created_by uuid not null default auth.uid() references public.staff_members(user_id),
  created_at timestamptz not null default now(),
  unique(employee_id, period_start, period_end),
  check (period_end >= period_start)
);
create index if not exists pay_stubs_employee_period_idx
  on public.pay_stubs(employee_id, period_end desc);
create index if not exists pay_stubs_created_by_idx
  on public.pay_stubs(created_by);

alter table public.employee_timesheets enable row level security;
alter table public.employee_commissions enable row level security;
alter table public.pay_stubs enable row level security;
grant select, insert, update, delete on public.employee_timesheets to authenticated;
grant select, insert, update, delete on public.employee_commissions to authenticated;
grant select, insert, update, delete on public.pay_stubs to authenticated;

drop policy if exists "Staff read own membership" on public.staff_members;
create policy "Staff can read permitted memberships" on public.staff_members
for select to authenticated
using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins insert staff memberships" on public.staff_members for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update staff memberships" on public.staff_members for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete staff memberships" on public.staff_members for delete to authenticated using ((select private.is_admin()));

drop policy if exists "Employees read own timesheets" on public.employee_timesheets;
drop policy if exists "Employees clock themselves in" on public.employee_timesheets;
drop policy if exists "Employees clock themselves out" on public.employee_timesheets;
drop policy if exists "Admins insert timesheets" on public.employee_timesheets;
drop policy if exists "Admins update timesheets" on public.employee_timesheets;
drop policy if exists "Admins delete timesheets" on public.employee_timesheets;
create policy "Employees read own timesheets" on public.employee_timesheets
for select to authenticated
using (employee_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins insert timesheets" on public.employee_timesheets
for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update timesheets" on public.employee_timesheets
for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete timesheets" on public.employee_timesheets
for delete to authenticated using ((select private.is_admin()));

create policy "Employees read own commissions" on public.employee_commissions
for select to authenticated
using (employee_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins insert commissions" on public.employee_commissions for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update commissions" on public.employee_commissions for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete commissions" on public.employee_commissions for delete to authenticated using ((select private.is_admin()));

create policy "Employees read own pay stubs" on public.pay_stubs
for select to authenticated
using (employee_id = (select auth.uid()) or (select private.is_admin()));
create policy "Admins insert pay stubs" on public.pay_stubs for insert to authenticated with check ((select private.is_admin()));
create policy "Admins update pay stubs" on public.pay_stubs for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete pay stubs" on public.pay_stubs for delete to authenticated using ((select private.is_admin()));

-- Salespeople can perform the operational tasks shown in their workspace.
drop policy if exists "Authenticated can insert vehicles" on public."Vehicles";
drop policy if exists "Authenticated can update vehicles" on public."Vehicles";
drop policy if exists "Authenticated can delete vehicles" on public."Vehicles";
create policy "Staff can insert vehicles" on public."Vehicles" for insert to authenticated with check ((select private.is_staff()));
create policy "Staff can update vehicles" on public."Vehicles" for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Admins can delete vehicles" on public."Vehicles" for delete to authenticated using ((select private.is_admin()));

drop policy if exists "Authenticated can insert vehicle images" on public.vehicle_images;
drop policy if exists "Authenticated can update vehicle images" on public.vehicle_images;
drop policy if exists "Authenticated can delete vehicle images" on public.vehicle_images;
create policy "Staff can insert vehicle images" on public.vehicle_images for insert to authenticated with check ((select private.is_staff()));
create policy "Staff can update vehicle images" on public.vehicle_images for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));
create policy "Staff can delete vehicle images" on public.vehicle_images for delete to authenticated using ((select private.is_staff()));

drop policy if exists "Authenticated can upload vehicle image files" on storage.objects;
drop policy if exists "Authenticated can update vehicle image files" on storage.objects;
drop policy if exists "Authenticated can delete vehicle image files" on storage.objects;
create policy "Staff can upload vehicle image files" on storage.objects for insert to authenticated
with check (bucket_id = 'vehicle-images' and (select private.is_staff()));
create policy "Staff can update vehicle image files" on storage.objects for update to authenticated
using (bucket_id = 'vehicle-images' and (select private.is_staff()))
with check (bucket_id = 'vehicle-images' and (select private.is_staff()));
create policy "Staff can delete vehicle image files" on storage.objects for delete to authenticated
using (bucket_id = 'vehicle-images' and (select private.is_staff()));

drop policy if exists "Authenticated users can view test drive bookings" on public.test_drive_bookings;
drop policy if exists "Authenticated users can update test drive bookings" on public.test_drive_bookings;
create policy "Staff can view test drive bookings" on public.test_drive_bookings for select to authenticated using ((select private.is_staff()));
create policy "Staff can update test drive bookings" on public.test_drive_bookings for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy if exists "Admins can view their test drive consents" on public.test_drive_consents;
create policy "Staff can view test drive consents" on public.test_drive_consents for select to authenticated using ((select private.is_staff()));

drop policy if exists "Authenticated users can view trade in requests" on public.trade_in_requests;
drop policy if exists "Authenticated users can update trade in requests" on public.trade_in_requests;
create policy "Staff can view trade in requests" on public.trade_in_requests for select to authenticated using ((select private.is_staff()));
create policy "Staff can update trade in requests" on public.trade_in_requests for update to authenticated using ((select private.is_staff())) with check ((select private.is_staff()));

drop policy if exists "Owner can read customer requests" on public.customer_requests;
drop policy if exists "Owner can update customer requests" on public.customer_requests;
create policy "Admins can read customer requests" on public.customer_requests for select to authenticated using ((select private.is_admin()));
create policy "Admins can update customer requests" on public.customer_requests for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
grant delete on table public.customer_requests to authenticated;
drop policy if exists "Admins can delete customer requests" on public.customer_requests;
create policy "Admins can delete customer requests" on public.customer_requests for delete to authenticated using ((select private.is_admin()));

drop policy if exists "Authenticated users can update finance settings" on public.finance_settings;
create policy "Admins can update finance settings" on public.finance_settings for update to authenticated
using (id = 1 and (select private.is_admin())) with check (id = 1 and (select private.is_admin()));

drop policy if exists "owner can read finance applications" on public.finance_applications;
drop policy if exists "owner can update finance applications" on public.finance_applications;
drop policy if exists "owner can delete finance applications" on public.finance_applications;
create policy "Admins can read finance applications" on public.finance_applications for select to authenticated using ((select private.is_admin()));
create policy "Admins can update finance applications" on public.finance_applications for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete finance applications" on public.finance_applications for delete to authenticated using ((select private.is_admin()));
