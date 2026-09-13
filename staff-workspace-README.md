# M.O Motors staff workspace

The private staff entry is `staff.html`; `admin.html` links to it. It reads the
existing `public."Vehicles"` rows. It does not change vehicle publication or
the customer-facing inventory. Owners see preparation messages and expenses;
both roles see sales messages/activity only after an owner marks that vehicle
ready. Owners and sales also have separate group chats.

## Before enabling sales accounts

1. Apply `staff-workspace-setup.sql` to the M.O Motors Supabase project.
2. Apply `staff-workspace-owner-seed.sql` for the current administrator.
3. Apply `staff-workspace-admin-hardening.sql` before creating **any** sales
   Auth account. Existing admin policies otherwise give any signed-in user
   broad access to inventory, bookings and trade-ins. This script also removes
   an anonymous finance-settings update policy.
4. In Supabase Storage, create a bucket named `staff-private` and leave it
   **private**, with an 8 MB image-only upload limit. The setup script includes
   its object policies. Never use the
   existing public `vehicle-images` bucket for internal photos.
5. Create staff users through Supabase Auth, then add their IDs and trusted
   roles and unique lowercase `handle`s to `public.staff_members` from a
   trusted administrator/SQL context.
   The browser has SELECT-only access to this table and cannot assign roles.
6. Apply `staff-workspace-notifications.sql`, then run
   `staff-workspace-security-test.sql` in a SQL session. It rolls back all test
   data and asserts owner/sales separation. Verify owner and sales accounts
   separately before publishing the page.
   Specifically, sales must receive zero rows from `staff_expenses` and
   `owner_vehicle`/`owner_group` messages, and must not update `Vehicles` or
   finance settings. An owner must retain existing admin access.

The staff schema, owner seed, admin hardening, notification rules, and private
`staff-private` bucket were applied to the live Supabase project on 2026-09-13.
The security test passed and rolled back its test data. No sales Auth accounts
have been created yet; add real staff accounts only after confirming their
email addresses and roles. Phone push remains disabled until the VAPID secrets,
dispatcher, and device verification below are completed.

Chat and the in-app alert inbox poll while the app is open. The installable
shell does not cache private API responses. The notification migration queues
alerts for @handles, replies to followed conversations, and vehicles marked
ready. A conversation can be followed or muted; sales staff can also turn off
ready-for-sale alerts. Role changes are rechecked before push delivery.

## To enable phone push

1. Generate one VAPID key pair. Put only the **public** key in
   `staff-config.js`. Keep the private key out of Git.
2. Configure Edge Function secrets `STAFF_VAPID_PUBLIC_KEY`,
   `STAFF_VAPID_PRIVATE_KEY`, `STAFF_VAPID_SUBJECT` (a valid `mailto:` or HTTPS
   contact), and a long random `STAFF_PUSH_DISPATCH_SECRET`. Supabase provides
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function.
3. Deploy `supabase/functions/staff-push` with `supabase/config.toml`.
   Its endpoint requires the dispatch secret header and does not accept a
   public browser call.
4. Store the project URL and the same dispatch secret in Supabase Vault under
   the names in `staff-push-cron.sql`, enable `pg_cron` and `pg_net`, then
   schedule the function with that SQL. It sends queued alerts once a minute.
5. On HTTPS, install the staff page to each phone's home screen and tap
   **Enable phone alerts**. Test an actual iPhone and Android delivery before
   calling push operational. No VAPID keys or cron job are configured yet.
