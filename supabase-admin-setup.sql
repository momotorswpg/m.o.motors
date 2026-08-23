-- M.O Motors admin/storage setup
-- Run this once in Supabase SQL Editor.

-- 1) Create the public storage bucket used by vehicle photos.
insert into storage.buckets (id, name, public)
values ('vehicle-images', 'vehicle-images', true)
on conflict (id) do update set public = true;

-- 2) Keep public inventory/photo reads available to the website.
grant select on table public."Vehicles" to anon, authenticated;
grant select on table public.vehicle_images to anon, authenticated;

drop policy if exists "Public can view vehicles" on public."Vehicles";
create policy "Public can view vehicles"
on public."Vehicles"
for select
to anon, authenticated
using (true);

drop policy if exists "Public can view vehicle images" on public.vehicle_images;
create policy "Public can view vehicle images"
on public.vehicle_images
for select
to anon, authenticated
using (true);

-- 3) Authenticated admins can manage vehicle records.
grant insert, update, delete on table public."Vehicles" to authenticated;

drop policy if exists "Authenticated can insert vehicles" on public."Vehicles";
create policy "Authenticated can insert vehicles"
on public."Vehicles"
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update vehicles" on public."Vehicles";
create policy "Authenticated can update vehicles"
on public."Vehicles"
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete vehicles" on public."Vehicles";
create policy "Authenticated can delete vehicles"
on public."Vehicles"
for delete
to authenticated
using (true);

-- 4) Authenticated admins can manage vehicle image records.
grant insert, update, delete on table public.vehicle_images to authenticated;

drop policy if exists "Authenticated can insert vehicle images" on public.vehicle_images;
create policy "Authenticated can insert vehicle images"
on public.vehicle_images
for insert
to authenticated
with check (true);

drop policy if exists "Authenticated can update vehicle images" on public.vehicle_images;
create policy "Authenticated can update vehicle images"
on public.vehicle_images
for update
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated can delete vehicle images" on public.vehicle_images;
create policy "Authenticated can delete vehicle images"
on public.vehicle_images
for delete
to authenticated
using (true);

-- 5) Storage: public can read images; authenticated admins can upload/update/delete.
drop policy if exists "Public can view vehicle image files" on storage.objects;
create policy "Public can view vehicle image files"
on storage.objects
for select
to public
using (bucket_id = 'vehicle-images');

drop policy if exists "Authenticated can upload vehicle image files" on storage.objects;
create policy "Authenticated can upload vehicle image files"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'vehicle-images');

drop policy if exists "Authenticated can update vehicle image files" on storage.objects;
create policy "Authenticated can update vehicle image files"
on storage.objects
for update
to authenticated
using (bucket_id = 'vehicle-images')
with check (bucket_id = 'vehicle-images');

drop policy if exists "Authenticated can delete vehicle image files" on storage.objects;
create policy "Authenticated can delete vehicle image files"
on storage.objects
for delete
to authenticated
using (bucket_id = 'vehicle-images');
