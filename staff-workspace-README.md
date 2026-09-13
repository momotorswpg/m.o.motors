# M.O Motors staff workspace (test only)

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
   roles to `public.staff_members` from a trusted administrator/SQL context.
   The browser has SELECT-only access to this table and cannot assign roles.
6. Verify owner and sales accounts separately before publishing the page.
   Specifically, sales must receive zero rows from `staff_expenses` and
   `owner_vehicle`/`owner_group` messages, and must not update `Vehicles` or
   finance settings. An owner must retain existing admin access.

The SQL was checked inside a transaction that was rolled back; it has **not**
been applied to the live database. The local staff page currently cannot sign
in until the setup is applied.

Chat updates poll while the app is open. The installable shell does not cache
private API responses. System push notifications, @mentions, replies/follows,
and cross-device mute preferences are **not implemented**; do not describe
them as active. Those need a notification data model and a securely configured
sender (including iOS/Android web-push testing) before staff onboarding.
