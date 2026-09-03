-- Adds the customer-facing payment estimate defaults managed from admin.html.
alter table public.finance_settings
  add column if not exists financing_fee numeric not null default 1000 check (financing_fee >= 0),
  add column if not exists payment_frequency text not null default 'biweekly'
    check (payment_frequency in ('weekly', 'biweekly', 'monthly'));

update public.finance_settings
set financing_fee = coalesce(financing_fee, 1000),
    payment_frequency = coalesce(payment_frequency, 'biweekly')
where id = 1;
