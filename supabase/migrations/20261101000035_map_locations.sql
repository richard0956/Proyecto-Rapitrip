-- Mapas, etapas M1 y M2: ubicación (pin) de las tiendas y del destino de cada pedido.
-- El pin es la fuente de verdad; la dirección escrita sigue siendo texto de apoyo. Las coordenadas van siempre completas
-- (latitud y longitud) o ninguna, y dentro de Nicaragua (con margen) para descartar pines mal puestos.
--
-- Privacidad: las coordenadas de una tienda solo las leen el comercio dueño y la administración (`stores_list`); las funciones
-- públicas `catalog_*` NO las devuelven. El pin del cliente vive con la dirección de entrega (se borra al anonimizar la cuenta).

-- Caja geográfica de Nicaragua con margen. Es solo un filtro contra errores de captura, no un dato de negocio.
create or replace function private.valid_ni_point(p_lat numeric, p_lng numeric)
returns boolean language sql immutable set search_path = '' as $$
  select p_lat between 10.5 and 15.3 and p_lng between -88.0 and -82.2;
$$;
grant execute on function private.valid_ni_point(numeric, numeric) to authenticated;

-- Tiendas ---------------------------------------------------------------------------------------------------------------

alter table commerce.stores
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add constraint stores_location_pair check ((latitude is null) = (longitude is null)),
  add constraint stores_location_range check (latitude is null or private.valid_ni_point(latitude, longitude));

create or replace view public.stores_list with (security_invoker = true) as
  select s.id, s.commerce_id, c.name as commerce_name, s.name, s.address, s.contact_phone, s.status,
         s.closed_until, s.closed_reason, s.created_at, s.updated_at,
         private.store_open_at(s) as open_now,
         (select count(*) from commerce.store_hours h where h.store_id = s.id) as hour_ranges,
         s.delivery_fee,
         s.latitude, s.longitude
  from commerce.stores s
  join identity.commerces c on c.id = s.commerce_id;

-- Fija o quita (con los dos valores nulos) la ubicación de una tienda.
create or replace function public.set_store_location(p_store uuid, p_latitude numeric, p_longitude numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'la ubicación va completa (latitud y longitud) o no va' using errcode = '22023';
  end if;
  if p_latitude is not null and not private.valid_ni_point(p_latitude, p_longitude) then
    raise exception 'la ubicación debe estar dentro de Nicaragua' using errcode = '22023';
  end if;
  update commerce.stores set latitude = p_latitude, longitude = p_longitude, updated_at = now() where id = p_store;
  -- La auditoría no guarda las coordenadas: solo si la tienda quedó ubicada.
  perform private.write_audit('store.location_changed', 'store', p_store::text, null,
    jsonb_build_object('located', p_latitude is not null));
end $$;

revoke all on function public.set_store_location(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.set_store_location(uuid, numeric, numeric) to authenticated;

-- Destino del pedido ----------------------------------------------------------------------------------------------------

alter table sales.order_delivery
  add column latitude numeric(9, 6),
  add column longitude numeric(9, 6),
  add constraint order_delivery_location_pair check ((latitude is null) = (longitude is null)),
  add constraint order_delivery_location_range check (latitude is null or private.valid_ni_point(latitude, longitude));

create or replace view public.order_delivery_list with (security_invoker = true) as
  select order_id, address, phone, notes, latitude, longitude from sales.order_delivery;

-- `create_order` recibe el pin como dos parámetros opcionales al final: las llamadas anteriores siguen funcionando.
drop function public.create_order(uuid, jsonb, text, text, text, text, uuid);

create or replace function public.create_order(
  p_store uuid, p_items jsonb, p_payment_method text, p_address text, p_phone text,
  p_notes text default null, p_client_ref uuid default null,
  p_latitude numeric default null, p_longitude numeric default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform private.require_valid_session();
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'la ubicación va completa (latitud y longitud) o no va' using errcode = '22023';
  end if;
  if p_latitude is not null and not private.valid_ni_point(p_latitude, p_longitude) then
    raise exception 'la ubicación marcada debe estar dentro de Nicaragua' using errcode = '22023';
  end if;

  if p_client_ref is null then
    v_id := private.create_order_core(p_store, p_items, p_payment_method, p_address, p_phone, p_notes);
  else
    -- Serializa los intentos simultáneos con la misma referencia: el segundo espera al primero y encuentra su pedido.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_client_ref::text, 0));
    select id into v_id from sales.orders where client_id = auth.uid() and client_ref = p_client_ref;
    if found then
      return v_id;
    end if;
    v_id := private.create_order_core(p_store, p_items, p_payment_method, p_address, p_phone, p_notes);
    update sales.orders set client_ref = p_client_ref where id = v_id;
  end if;

  if p_latitude is not null then
    update sales.order_delivery set latitude = p_latitude, longitude = p_longitude where order_id = v_id;
  end if;
  return v_id;
end $$;

revoke all on function public.create_order(uuid, jsonb, text, text, text, text, uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.create_order(uuid, jsonb, text, text, text, text, uuid, numeric, numeric) to authenticated;

-- Libreta de direcciones del cliente ------------------------------------------------------------------------------------
-- La tabla ya tenía `latitude` y `longitude`; `save_address` las acepta desde la etapa 3 de la Fase 4. Aquí solo se les
-- exige estar dentro de Nicaragua, con un disparador para devolver un mensaje claro en lugar de un error de restricción.

create or replace function private.check_address_location()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.latitude is not null and not private.valid_ni_point(new.latitude, new.longitude) then
    raise exception 'la ubicación marcada debe estar dentro de Nicaragua' using errcode = '22023';
  end if;
  return new;
end $$;

create trigger customer_addresses_check_location
  before insert or update of latitude, longitude on sales.customer_addresses
  for each row execute function private.check_address_location();
