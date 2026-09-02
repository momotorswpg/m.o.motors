-- Additional financing history fields used by pre-approval.html.
-- Applied to the MoMotors Supabase project on 2026-09-02.

alter table public.finance_applications
  add column if not exists previous_address text,
  add column if not exists previous_city text,
  add column if not exists previous_province text,
  add column if not exists previous_postal_code text,
  add column if not exists previous_address_duration text,
  add column if not exists previous_employer text,
  add column if not exists previous_occupation text,
  add column if not exists previous_employment_duration text;
