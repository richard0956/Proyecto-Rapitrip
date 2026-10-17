-- Fase 2, etapa 1: tiendas de un comercio, horarios semanales, excepciones por fecha y cierre temporal.
-- Las tablas viven en el esquema `commerce` (no expuesto); las apps leen vistas de `public` y escriben por funciones.

create schema if not exists commerce;
revoke all on schema commerce from public, anon, authenticated;
grant usage on schema commerce to authenticated;
alter default privileges for role postgres in schema commerce revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema commerce revoke all on sequences from anon, authenticated, service_role;

create table commerce.stores (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references identity.commerces(id),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  address text check (address is null or char_length(address) <= 240),
  contact_phone text check (contact_phone is null or contact_phone ~ '^[0-9+() -]{8,20}$'),
  status text not null default 'activa' check (status in ('activa', 'inactiva')),
  closed_until timestamptz,
  closed_reason text check (closed_reason is null or char_length(closed_reason) <= 200),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stores_commerce_idx on commerce.stores (commerce_id);
create unique index stores_unique_name_per_commerce on commerce.stores (commerce_id, lower(btrim(name)));

-- Horario semanal: 0 = domingo … 6 = sábado. Un día puede tener varios tramos (p. ej. almuerzo y cena).
create table commerce.store_hours (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references commerce.stores(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens time not null,
  closes time not null,
  check (opens < closes)
);
create index store_hours_store_idx on commerce.store_hours (store_id, weekday);

-- Excepciones por fecha: cierre completo (feriado) o un horario distinto ese día.
create table commerce.store_exceptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references commerce.stores(id) on delete cascade,
  on_date date not null,
  closed boolean not null default true,
  opens time,
  closes time,
  note text check (note is null or char_length(note) <= 120),
  unique (store_id, on_date),
  check ((closed and opens is null and closes is null) or (not closed and opens is not null and closes is not null and opens < closes))
);

alter table commerce.stores enable row level security;
alter table commerce.store_hours enable row level security;
alter table commerce.store_exceptions enable row level security;

-- Lectura: el comercio ve lo suyo; la administración, todo. Escribir solo por funciones.
create policy stores_select_own on commerce.stores
  for select to authenticated using (private.has_role('comercio', commerce_id));
create policy stores_select_admin on commerce.stores
  for select to authenticated using (private.is_admin_console());

create policy store_hours_select_own on commerce.store_hours
  for select to authenticated using (exists (
    select 1 from commerce.stores s where s.id = store_hours.store_id and private.has_role('comercio', s.commerce_id)));
create policy store_hours_select_admin on commerce.store_hours
  for select to authenticated using (private.is_admin_console());

create policy store_exceptions_select_own on commerce.store_exceptions
  for select to authenticated using (exists (
    select 1 from commerce.stores s where s.id = store_exceptions.store_id and private.has_role('comercio', s.commerce_id)));
create policy store_exceptions_select_admin on commerce.store_exceptions
  for select to authenticated using (private.is_admin_console());

grant select on commerce.stores, commerce.store_hours, commerce.store_exceptions to authenticated;

-- Quién puede gestionar las tiendas de un comercio: la administración o la cuenta de ese comercio, siempre con sesión de consola.
create or replace function private.require_store_manager(p_commerce uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_console_session();
  if private.has_any_role(array['admin', 'superadmin']::identity.app_role[]) then
    return;
  end if;
  if not private.has_role('comercio', p_commerce) then
    raise exception 'no puedes gestionar las tiendas de este comercio' using errcode = '42501';
  end if;
end $$;

create or replace function private.store_commerce(p_store uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  select commerce_id into v from commerce.stores where id = p_store;
  if v is null then
    raise exception 'tienda no encontrada' using errcode = 'P0002';
  end if;
  return v;
end $$;

create or replace function private.validate_store(p_name text, p_address text, p_phone text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_name is null or char_length(btrim(p_name)) not between 2 and 80 then
    raise exception 'el nombre de la tienda debe tener entre 2 y 80 caracteres' using errcode = '22023';
  end if;
  if p_address is not null and char_length(p_address) > 240 then
    raise exception 'la dirección es demasiado larga' using errcode = '22023';
  end if;
  if p_phone is not null and p_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'teléfono inválido' using errcode = '22023';
  end if;
end $$;

create or replace function public.create_store(
  p_commerce uuid, p_name text, p_address text default null, p_phone text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_store_manager(p_commerce);
  if not exists (select 1 from identity.commerces where id = p_commerce and status = 'activo') then
    raise exception 'comercio no disponible' using errcode = 'P0002';
  end if;
  perform private.validate_store(p_name, p_address, p_phone);
  begin
    insert into commerce.stores (commerce_id, name, address, contact_phone, created_by)
    values (p_commerce, btrim(p_name), nullif(btrim(p_address), ''), p_phone, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya existe una tienda con ese nombre' using errcode = '23505';
  end;
  perform private.write_audit('store.created', 'store', v_id::text, null, jsonb_build_object('commerce_id', p_commerce));
  return v_id;
end $$;

create or replace function public.update_store(
  p_store uuid, p_name text, p_address text default null, p_phone text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old commerce.stores;
  v_changed text[] := '{}';
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  perform private.validate_store(p_name, p_address, p_phone);
  select * into v_old from commerce.stores where id = p_store for update;
  if v_old.name is distinct from btrim(p_name) then v_changed := array_append(v_changed, 'name'); end if;
  if v_old.address is distinct from nullif(btrim(p_address), '') then v_changed := array_append(v_changed, 'address'); end if;
  if v_old.contact_phone is distinct from p_phone then v_changed := array_append(v_changed, 'contact'); end if;
  begin
    update commerce.stores
      set name = btrim(p_name), address = nullif(btrim(p_address), ''), contact_phone = p_phone, updated_at = now()
      where id = p_store;
  exception when unique_violation then
    raise exception 'ya existe una tienda con ese nombre' using errcode = '23505';
  end;
  perform private.write_audit('store.updated', 'store', p_store::text, null,
    jsonb_build_object('changed_fields', to_jsonb(v_changed)));
end $$;

-- Activar o desactivar una tienda (desactivada = no aparece ni vende, pero conserva su historial).
create or replace function public.set_store_status(p_store uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  if p_status not in ('activa', 'inactiva') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  if p_status = 'inactiva' and (p_reason is null or char_length(btrim(p_reason)) < 5) then
    raise exception 'indica el motivo (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  update commerce.stores set status = p_status, updated_at = now() where id = p_store;
  perform private.write_audit('store.status_changed', 'store', p_store::text, null,
    jsonb_build_object('status', p_status), p_reason);
end $$;

-- Cierre temporal: la tienda no recibe pedidos hasta la fecha indicada (o hasta que se reabra a mano).
create or replace function public.close_store_temporarily(p_store uuid, p_until timestamptz, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  if p_until is null or p_until <= now() then
    raise exception 'la fecha de reapertura debe ser futura' using errcode = '22023';
  end if;
  if p_until > now() + interval '90 days' then
    raise exception 'el cierre temporal no puede pasar de 90 días' using errcode = '22023';
  end if;
  if p_reason is not null and char_length(p_reason) > 200 then
    raise exception 'el motivo es demasiado largo' using errcode = '22023';
  end if;
  update commerce.stores set closed_until = p_until, closed_reason = nullif(btrim(p_reason), ''), updated_at = now()
    where id = p_store;
  perform private.write_audit('store.closed_temporarily', 'store', p_store::text, null,
    jsonb_build_object('closed_until', p_until), p_reason);
end $$;

create or replace function public.reopen_store(p_store uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  update commerce.stores set closed_until = null, closed_reason = null, updated_at = now() where id = p_store;
  perform private.write_audit('store.reopened', 'store', p_store::text);
end $$;

-- Reemplaza el horario semanal completo. p_hours: [{"weekday":1,"opens":"08:00","closes":"17:00"}, …]
create or replace function public.set_store_hours(p_store uuid, p_hours jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_count int := 0;
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  if p_hours is null or jsonb_typeof(p_hours) <> 'array' or jsonb_array_length(p_hours) > 42 then
    raise exception 'horario inválido' using errcode = '22023';
  end if;
  delete from commerce.store_hours where store_id = p_store;
  for v_item in select * from jsonb_array_elements(p_hours) loop
    begin
      insert into commerce.store_hours (store_id, weekday, opens, closes)
      values (p_store, (v_item ->> 'weekday')::smallint, (v_item ->> 'opens')::time, (v_item ->> 'closes')::time);
    exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
      raise exception 'tramo de horario inválido' using errcode = '22023';
    end;
    v_count := v_count + 1;
  end loop;
  -- Los tramos de un mismo día no pueden traslaparse.
  if exists (
    select 1 from commerce.store_hours a join commerce.store_hours b
      on a.store_id = b.store_id and a.weekday = b.weekday and a.id < b.id
     and a.opens < b.closes and b.opens < a.closes
    where a.store_id = p_store
  ) then
    raise exception 'hay tramos que se traslapan en un mismo día' using errcode = '22023';
  end if;
  perform private.write_audit('store.hours_changed', 'store', p_store::text, null,
    jsonb_build_object('ranges', v_count));
end $$;

create or replace function public.set_store_exception(
  p_store uuid, p_date date, p_closed boolean, p_opens time default null, p_closes time default null, p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  if p_date is null or p_date < current_date then
    raise exception 'la fecha no puede estar en el pasado' using errcode = '22023';
  end if;
  begin
    insert into commerce.store_exceptions (store_id, on_date, closed, opens, closes, note)
    values (p_store, p_date, coalesce(p_closed, true),
            case when coalesce(p_closed, true) then null else p_opens end,
            case when coalesce(p_closed, true) then null else p_closes end,
            nullif(btrim(p_note), ''))
    on conflict (store_id, on_date) do update
      set closed = excluded.closed, opens = excluded.opens, closes = excluded.closes, note = excluded.note;
  exception when check_violation then
    raise exception 'excepción inválida: indica apertura y cierre, con la apertura antes del cierre' using errcode = '22023';
  end;
  perform private.write_audit('store.exception_set', 'store', p_store::text, null,
    jsonb_build_object('on_date', p_date, 'closed', coalesce(p_closed, true)));
end $$;

create or replace function public.delete_store_exception(p_store uuid, p_date date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  delete from commerce.store_exceptions where store_id = p_store and on_date = p_date;
  perform private.write_audit('store.exception_deleted', 'store', p_store::text, null,
    jsonb_build_object('on_date', p_date));
end $$;

-- ¿Está abierta ahora? Activa, sin cierre temporal vigente y dentro de un tramo (o de la excepción de hoy).
-- Hora de Costa Rica, que es donde opera Rapitrip.
create or replace function private.store_open_at(p_store commerce.stores, p_at timestamptz default now())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_local timestamp := p_at at time zone 'America/Costa_Rica';
  v_exc commerce.store_exceptions;
begin
  if p_store.status <> 'activa' then return false; end if;
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

create view public.stores_list with (security_invoker = true) as
  select s.id, s.commerce_id, c.name as commerce_name, s.name, s.address, s.contact_phone, s.status,
         s.closed_until, s.closed_reason, s.created_at, s.updated_at,
         private.store_open_at(s) as open_now,
         (select count(*) from commerce.store_hours h where h.store_id = s.id) as hour_ranges
  from commerce.stores s
  join identity.commerces c on c.id = s.commerce_id;

create view public.store_hours_list with (security_invoker = true) as
  select id, store_id, weekday, to_char(opens, 'HH24:MI') as opens, to_char(closes, 'HH24:MI') as closes
  from commerce.store_hours;

create view public.store_exceptions_list with (security_invoker = true) as
  select id, store_id, on_date, closed, to_char(opens, 'HH24:MI') as opens, to_char(closes, 'HH24:MI') as closes, note
  from commerce.store_exceptions;

revoke all on function public.create_store(uuid, text, text, text),
  public.update_store(uuid, text, text, text),
  public.set_store_status(uuid, text, text),
  public.close_store_temporarily(uuid, timestamptz, text),
  public.reopen_store(uuid),
  public.set_store_hours(uuid, jsonb),
  public.set_store_exception(uuid, date, boolean, time, time, text),
  public.delete_store_exception(uuid, date)
from public, anon;
grant execute on function public.create_store(uuid, text, text, text),
  public.update_store(uuid, text, text, text),
  public.set_store_status(uuid, text, text),
  public.close_store_temporarily(uuid, timestamptz, text),
  public.reopen_store(uuid),
  public.set_store_hours(uuid, jsonb),
  public.set_store_exception(uuid, date, boolean, time, time, text),
  public.delete_store_exception(uuid, date)
to authenticated;
grant execute on function private.store_open_at(commerce.stores, timestamptz) to authenticated;

revoke all on public.stores_list, public.store_hours_list, public.store_exceptions_list from public, anon;
grant select on public.stores_list, public.store_hours_list, public.store_exceptions_list to authenticated;
