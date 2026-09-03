-- Co-signer and consent fields used by pre-approval.html.
-- Applied to the MoMotors Supabase project on 2026-09-03.

alter table public.finance_applications
  add column if not exists has_cosigner boolean not null default false,
  add column if not exists cosigner_first_name text,
  add column if not exists cosigner_last_name text,
  add column if not exists cosigner_phone text,
  add column if not exists cosigner_email text,
  add column if not exists cosigner_date_of_birth date,
  add column if not exists cosigner_address text,
  add column if not exists cosigner_city text,
  add column if not exists cosigner_province text,
  add column if not exists cosigner_postal_code text,
  add column if not exists cosigner_employment_status text,
  add column if not exists cosigner_employer text,
  add column if not exists cosigner_occupation text,
  add column if not exists cosigner_monthly_income numeric,
  add column if not exists credit_consent boolean not null default false,
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists consented_at timestamptz;
