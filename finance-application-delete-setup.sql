-- Allow only the M.O Motors owner account to permanently delete finance applications.
-- Apply once in the Supabase SQL editor (or through the connected migration tool).

grant delete on table public.finance_applications to authenticated;

drop policy if exists "owner can delete finance applications" on public.finance_applications;
create policy "owner can delete finance applications"
on public.finance_applications
for delete
to authenticated
using ((select auth.jwt()->>'email') = 'momotorswpg@gmail.com');
