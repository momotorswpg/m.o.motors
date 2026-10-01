create or replace function private.unfeature_sold_vehicle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if lower(coalesce(new."Status", '')) = 'sold' then
    new."Featured" := false;
    new.featured := false;
    new.featured_order := null;
  end if;
  return new;
end;
$$;

revoke all on function private.unfeature_sold_vehicle() from public, anon, authenticated;

drop trigger if exists unfeature_sold_vehicle on public."Vehicles";

create trigger unfeature_sold_vehicle
before insert or update of "Status", "Featured", featured, featured_order
on public."Vehicles"
for each row
execute function private.unfeature_sold_vehicle();

update public."Vehicles"
set "Featured" = false,
    featured = false,
    featured_order = null
where lower(coalesce("Status", '')) = 'sold'
  and (coalesce("Featured", false) or coalesce(featured, false) or featured_order is not null);
