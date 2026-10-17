-- Rapitrip opera en Nicaragua: el horario de las tiendas se evalúa en America/Managua (UTC−6, sin horario de verano).
-- Las migraciones 19 y 23 lo evaluaban en America/Costa_Rica (mismo desfase, pero el nombre de la zona era el equivocado).

create or replace function private.store_open_at(p_store commerce.stores, p_at timestamptz default now())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_local timestamp := p_at at time zone 'America/Managua';
  v_exc commerce.store_exceptions;
begin
  if p_store.status <> 'activa' then return false; end if;
  if not exists (select 1 from identity.commerces where id = p_store.commerce_id and status = 'activo') then return false; end if;
  if p_store.closed_until is not null and p_store.closed_until > p_at then return false; end if;
  select * into v_exc from commerce.store_exceptions where store_id = p_store.id and on_date = v_local::date;
  if found then
    return not v_exc.closed and v_local::time >= v_exc.opens and v_local::time < v_exc.closes;
  end if;
  return exists (
    select 1 from commerce.store_hours h
    where h.store_id = p_store.id and h.weekday = extract(dow from v_local)::smallint
      and v_local::time >= h.opens and v_local::time < h.closes);
end $$;
