-- Run after staff-workspace-setup.sql, before admin hardening.
-- Only the existing M.O Motors administrator is seeded as owner.
insert into public.staff_members (user_id,display_name,role)
select id,'M.O Motors Owner','owner' from auth.users
where email = 'momotorswpg@gmail.com'
on conflict (user_id) do update set role = 'owner';
