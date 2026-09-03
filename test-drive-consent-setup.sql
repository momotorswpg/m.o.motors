-- Paperless test drive consent records created from admin.html.
-- Signatures and terms are immutable after insertion.

create table if not exists public.test_drive_consents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.test_drive_bookings(id) on delete set null,
  vehicle_id bigint references public."Vehicles"(id) on delete set null,
  vehicle_name text not null,
  driver_name text not null,
  phone text not null,
  email text,
  licence_number text not null,
  licence_province text not null,
  licence_expiry date not null,
  drive_date date not null,
  start_time time not null,
  odometer_out bigint,
  odometer_in bigint,
  staff_name text not null,
  driver_typed_name text not null,
  driver_signature text not null,
  staff_signature text not null,
  consent_version text not null,
  consent_text text not null,
  signed_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint test_drive_consents_odometer_check check (odometer_in is null or odometer_out is null or odometer_in >= odometer_out)
);

alter table public.test_drive_consents enable row level security;
revoke all on table public.test_drive_consents from anon;
grant select, insert on table public.test_drive_consents to authenticated;

drop policy if exists "Admins can view their test drive consents" on public.test_drive_consents;
create policy "Admins can view their test drive consents"
  on public.test_drive_consents for select to authenticated
  using ((select auth.uid()) = created_by);

drop policy if exists "Admins can create test drive consents" on public.test_drive_consents;
create policy "Admins can create test drive consents"
  on public.test_drive_consents for insert to authenticated
  with check ((select auth.uid()) = created_by);

create index if not exists test_drive_consents_booking_idx on public.test_drive_consents(booking_id);
create index if not exists test_drive_consents_signed_at_idx on public.test_drive_consents(signed_at desc);
