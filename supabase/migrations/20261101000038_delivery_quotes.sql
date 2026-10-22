-- Envío por distancia real por calle.
--
-- La base de datos no puede consultar a Mapbox, así que la función de borde `quote-delivery` calcula la distancia por calle y la
-- entrega aquí con la clave de servicio. Cada cotización queda guardada (15 minutos de vigencia) y `create_order` la usa por su
-- identificador: la zona y el cobro siempre los decide la base de datos, y solo acepta cotizaciones escritas por la función de borde,
-- del mismo cliente, de la misma tienda y del mismo punto. Sin cotización (función caída, sin token o la ruta no responde) se usa
-- la línea recta por el factor de ruta de la migración 37, como hasta ahora.

create table sales.delivery_quotes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  store_id uuid not null references commerce.stores(id),
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  method text not null check (method in ('ruta', 'linea_recta')),
  distance_km numeric(5, 1) not null,
  zone smallint not null references sales.delivery_zones(zone),
  customer_fee numeric(10, 2) not null,
  courier_pay numeric(10, 2) not null,
  margin numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index delivery_quotes_client_idx on sales.delivery_quotes (client_id, created_at desc);
alter table sales.delivery_quotes enable row level security;

-- Cómo se calculó la distancia de cada pedido (para las liquidaciones y la auditoría).
alter table sales.orders add column delivery_method text check (delivery_method in ('ruta', 'linea_recta'));

-- Coordenadas de la tienda para la función de borde (solo clave de servicio).
create or replace function public.delivery_store_point(p_store uuid)
returns table (latitude numeric, longitude numeric)
language sql stable security definer set search_path = '' as $$
  select s.latitude, s.longitude from commerce.stores s where s.id = p_store;
$$;

-- Guarda la cotización de un cliente. `p_road_km` es la distancia por calle de Mapbox; nula = usar la línea recta por el factor.
create or replace function public.record_delivery_quote(p_client uuid, p_store uuid, p_latitude numeric, p_longitude numeric, p_road_km numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_zone record;
  v_s_lat numeric;
  v_s_lng numeric;
  v_km numeric;
  v_method text;
  v_max numeric;
  v_id uuid;
begin
  if p_client is null or not exists (select 1 from identity.profiles where id = p_client) then
    raise exception 'cliente no encontrado' using errcode = 'P0002';
  end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'marca el punto de entrega en el mapa' using errcode = '22023';
  end if;
  if not private.valid_ni_point(p_latitude, p_longitude) then
    raise exception 'el punto de entrega debe estar dentro de Nicaragua' using errcode = '22023';
  end if;
  select s.latitude, s.longitude into v_s_lat, v_s_lng from commerce.stores s where s.id = p_store;
  if not found then
    raise exception 'tienda no disponible' using errcode = 'P0002';
  end if;
  if v_s_lat is null then
    raise exception 'esta tienda aún no tiene su ubicación en el mapa y no puede recibir pedidos a domicilio' using errcode = '22023';
  end if;

  if p_road_km is not null then
    if p_road_km <= 0 or p_road_km > 1000 then
      raise exception 'distancia inválida' using errcode = '22023';
    end if;
    v_km := round(p_road_km, 1);
    v_method := 'ruta';
  else
    v_km := round(private.haversine_km(v_s_lat, v_s_lng, p_latitude, p_longitude) * (select ds.road_factor from sales.delivery_settings ds), 1);
    v_method := 'linea_recta';
  end if;

  select z.zone, z.up_to_km, z.customer_fee, z.courier_pay, z.margin into v_zone
    from sales.delivery_zones z where v_km <= z.up_to_km order by z.up_to_km limit 1;
  if not found then
    select max(z.up_to_km) into v_max from sales.delivery_zones z;
    raise exception 'tu punto de entrega queda a más de % km de la tienda: el envío no está disponible', trim_scale(v_max) using errcode = '22023';
  end if;

  delete from sales.delivery_quotes where expires_at < now() - interval '1 day';
  insert into sales.delivery_quotes (client_id, store_id, latitude, longitude, method, distance_km, zone, customer_fee, courier_pay, margin, expires_at)
  values (p_client, p_store, round(p_latitude, 6), round(p_longitude, 6), v_method, v_km, v_zone.zone, v_zone.customer_fee, v_zone.courier_pay, v_zone.margin,
          now() + interval '15 minutes')
  returning id into v_id;
  return jsonb_build_object('quote_id', v_id, 'zone', v_zone.zone, 'up_to_km', v_zone.up_to_km, 'fee', v_zone.customer_fee, 'method', v_method);
end $$;

revoke all on function public.delivery_store_point(uuid), public.record_delivery_quote(uuid, uuid, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.delivery_store_point(uuid), public.record_delivery_quote(uuid, uuid, numeric, numeric, numeric) to service_role;

-- `create_order` acepta la cotización por ruta (`p_quote_id`); sin ella cotiza por línea recta como antes.
drop function public.create_order(uuid, jsonb, text, text, text, text, uuid, numeric, numeric);

create or replace function public.create_order(
  p_store uuid, p_items jsonb, p_payment_method text, p_address text, p_phone text,
  p_notes text default null, p_client_ref uuid default null,
  p_latitude numeric default null, p_longitude numeric default null, p_quote_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_quote record;
  v_zone smallint;
  v_fee numeric;
  v_pay numeric;
  v_margin numeric;
  v_km numeric;
  v_method text;
begin
  perform private.require_valid_session();
  if p_latitude is null or p_longitude is null then
    raise exception 'marca el punto de entrega en el mapa' using errcode = '22023';
  end if;

  if p_client_ref is not null then
    -- Serializa los intentos simultáneos con la misma referencia: el segundo espera al primero y encuentra su pedido.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_client_ref::text, 0));
    select id into v_id from sales.orders where client_id = auth.uid() and client_ref = p_client_ref;
    if found then
      return v_id;
    end if;
  end if;

  if p_quote_id is not null then
    select * into v_quote from sales.delivery_quotes where id = p_quote_id and client_id = auth.uid();
    if not found or v_quote.expires_at < now() then
      raise exception 'la cotización del envío venció: marca de nuevo tu punto de entrega' using errcode = '22023';
    end if;
    if v_quote.store_id <> p_store or abs(v_quote.latitude - p_latitude) > 0.000002 or abs(v_quote.longitude - p_longitude) > 0.000002 then
      raise exception 'la cotización del envío no corresponde a ese punto de entrega' using errcode = '22023';
    end if;
    v_zone := v_quote.zone; v_fee := v_quote.customer_fee; v_pay := v_quote.courier_pay; v_margin := v_quote.margin;
    v_km := v_quote.distance_km; v_method := v_quote.method;
  else
    -- Falla antes de reservar nada si falta alguna ubicación o el destino queda fuera de cobertura.
    select * into v_quote from private.delivery_quote(p_store, p_latitude, p_longitude);
    v_zone := v_quote.zone; v_fee := v_quote.customer_fee; v_pay := v_quote.courier_pay; v_margin := v_quote.margin;
    v_km := v_quote.distance_km; v_method := 'linea_recta';
  end if;

  v_id := private.create_order_core(p_store, p_items, p_payment_method, p_address, p_phone, p_notes);
  if p_client_ref is not null then
    update sales.orders set client_ref = p_client_ref where id = v_id;
  end if;

  update sales.orders
     set delivery_fee = v_fee, total = subtotal + v_fee,
         delivery_zone = v_zone, delivery_distance_km = v_km, delivery_method = v_method,
         courier_pay = v_pay, delivery_margin = v_margin
   where id = v_id;
  update sales.order_delivery set latitude = p_latitude, longitude = p_longitude where order_id = v_id;
  perform private.write_audit('order.delivery_priced', 'order', v_id::text, null,
    jsonb_build_object('zone', v_zone, 'delivery_fee', v_fee, 'method', v_method));
  return v_id;
end $$;

revoke all on function public.create_order(uuid, jsonb, text, text, text, text, uuid, numeric, numeric, uuid) from public, anon, authenticated;
grant execute on function public.create_order(uuid, jsonb, text, text, text, text, uuid, numeric, numeric, uuid) to authenticated;
