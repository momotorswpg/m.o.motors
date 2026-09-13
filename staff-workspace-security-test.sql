-- Run in one SQL session AFTER the setup, owner seed, hardening, and
-- notification scripts have been applied. Everything here is rolled back.
begin;
select set_config('request.jwt.claim.sub',
  (select id::text from auth.users where email='momotorswpg@gmail.com' limit 1),true);
set local role authenticated;

insert into public.staff_messages(channel,author_id,author_name,body)
select 'owner_group',user_id,display_name,'Rollback-only owner message'
from public.staff_members where user_id=(select auth.uid());
insert into public.staff_messages(channel,author_id,author_name,body)
select 'sales_group',user_id,display_name,'Rollback-only sales message'
from public.staff_members where user_id=(select auth.uid());
insert into public.staff_expenses(vehicle_id,kind,description,amount,created_by)
select id,'other','Rollback-only expense',1,(select auth.uid())
from public."Vehicles" order by id limit 1;
insert into public.staff_vehicle_state(vehicle_id,ready_by)
select id,(select auth.uid()) from public."Vehicles" order by id limit 1;
insert into public.staff_messages(vehicle_id,channel,author_id,author_name,body)
select id,'sales_vehicle',(select auth.uid()),
  (select display_name from public.staff_members where user_id=(select auth.uid())),
  'Rollback-only pre-ready sales message'
from public."Vehicles" order by id limit 1;

do $$ begin
  if (select count(*) from public.staff_messages where channel='owner_group') <> 1
    or (select count(*) from public.staff_expenses) <> 1 then
    raise exception 'Owner access regression';
  end if;
end $$;

reset role;
insert into public.staff_notifications(user_id,kind,channel,title,body)
select id,'mention','owner_group','Rollback-only owner alert','Private owner text'
from auth.users where email='momotorswpg@gmail.com';
update public.staff_members set role='sales'
where user_id=(select id from auth.users where email='momotorswpg@gmail.com' limit 1);
set local role authenticated;
do $$ declare changed integer; begin
  if (select count(*) from public.staff_messages where channel='owner_group') <> 0
    or (select count(*) from public.staff_expenses) <> 0
    or (select count(*) from public.staff_notifications where channel='owner_group') <> 0
    or (select count(*) from public.staff_follows where channel='owner_group') <> 0
    or (select count(*) from public.staff_messages where channel='sales_vehicle') <> 0
    or (select count(*) from public.staff_messages where channel='sales_group') <> 1 then
    raise exception 'Sales room isolation regression';
  end if;
  update public."Vehicles" set "Price"="Price" where id=(select min(id) from public."Vehicles");
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Sales can edit public inventory'; end if;
  update public.finance_settings set apr=apr where id=1;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Sales can edit finance defaults'; end if;
end $$;
reset role;
update public.staff_vehicle_state set ready_for_sale=true,ready_at=now(),ready_by=null
where vehicle_id=(select min(id) from public."Vehicles");
set local role authenticated;
do $$ begin
  if (select count(*) from public.staff_messages where channel='sales_vehicle') <> 1
    or (select count(*) from public.staff_notifications where kind='ready') <> 1
    or (select count(*) from public.staff_expenses) <> 0 then
    raise exception 'Ready-for-sale access or notification regression';
  end if;
end $$;
rollback;
