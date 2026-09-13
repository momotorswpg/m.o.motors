-- Apply before inviting any sales staff to Supabase Auth. This preserves the
-- existing owner's access while removing broad authenticated admin access.
-- Requires staff-workspace-setup.sql and an owner row in staff_members.

alter policy "Authenticated can delete vehicles" on public."Vehicles"
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
alter policy "Authenticated can insert vehicles" on public."Vehicles"
  with check (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
alter policy "Authenticated can update vehicles" on public."Vehicles"
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));

alter policy "Authenticated can delete vehicle images" on public.vehicle_images
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
alter policy "Authenticated can insert vehicle images" on public.vehicle_images
  with check (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
alter policy "Authenticated can update vehicle images" on public.vehicle_images
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));

alter policy "Authenticated users can view test drive bookings" on public.test_drive_bookings
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
alter policy "Authenticated users can update test drive bookings" on public.test_drive_bookings
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));

alter policy "Authenticated users can view trade in requests" on public.trade_in_requests
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
alter policy "Authenticated users can update trade in requests" on public.trade_in_requests
  using (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));

alter policy "Authenticated users can update finance settings" on public.finance_settings
  using (id = 1 and exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (id = 1 and exists (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
drop policy if exists "Allow finance settings update" on public.finance_settings;
revoke update on public.finance_settings from anon;

alter policy "Authenticated can delete vehicle image files" on storage.objects
  using (bucket_id = 'vehicle-images' and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
alter policy "Authenticated can update vehicle image files" on storage.objects
  using (bucket_id = 'vehicle-images' and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (bucket_id = 'vehicle-images' and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
alter policy "Authenticated can upload vehicle image files" on storage.objects
  with check (bucket_id = 'vehicle-images' and exists
    (select 1 from public.staff_members m where m.user_id = (select auth.uid()) and m.role = 'owner'));
