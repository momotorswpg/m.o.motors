-- Apply only after staff-push Edge Function is deployed and both secrets exist
-- in Supabase Vault. Do not place either secret value in this repository.
-- Vault secret names:
--   staff_push_project_url      e.g. https://<project-ref>.supabase.co
--   staff_push_dispatch_secret  same long random value as Edge Function env
-- Requires pg_cron and pg_net extensions.
select cron.schedule(
  'staff-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='staff_push_project_url') || '/functions/v1/staff-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-staff-dispatch-secret',(select decrypted_secret from vault.decrypted_secrets where name='staff_push_dispatch_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
