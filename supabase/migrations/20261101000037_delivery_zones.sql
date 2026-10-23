-- Envío por zona: el costo de entrega de un pedido depende de la distancia entre la tienda y el pin del cliente.
-- Reemplaza el costo de envío fijo por tienda (`commerce.stores.delivery_fee`, que queda sin uso en los pedidos nuevos).
--
-- Tabulador (córdobas):  zona | hasta (km) | pago al repartidor | margen de Rapitrip | cobro al cliente
--                          1  |     3      |        40          |        10          |       50
--                          2  |     6      |        55          |        10          |       65
--                          3  |    10      |        80          |        10          |       90
--                          4  |    15      |       110          |        15          |      125
--                          5  |    20      |       140          |        15          |      155
-- Más allá de 20 km no se entrega. La distancia es la de línea recta entre los dos pines multiplicada por un factor de
-- ruta (1,30 por defecto, porque por calle se recorre más), redondeada a 0,1 km; la zona es la primera cuyo tope la cubre.
-- La base de datos decide el monto: el navegador solo muestra lo que ella cotiza.

create table sales.delivery_zones (
  zone smallint primary key check (zone between 1 and 20),
  up_to_km numeric(5, 1) not null unique check (up_to_km > 0),
  courier_pay numeric(10, 2) not null check (courier_pay >= 0),
  margin numeric(10, 2) not null check (margin >= 0),
  customer_fee numeric(10, 2) generated always as (courier_pay + margin) stored
);
insert into sales.delivery_zones (zone, up_to_km, courier_pay, margin) values
  (1, 3, 40, 10), (2, 6, 55, 10), (3, 10, 80, 10), (4, 15, 110, 15), (5, 20, 140, 15);

create table sales.delivery_settings (
  id boolean primary key default true check (id),
  road_factor numeric(3, 2) not null default 1.30 check (road_factor between 1 and 3)
);
insert into sales.delivery_settings default values;

alter table sales.delivery_zones enable row level security;
alter table sales.delivery_settings enable row level security;

-- Lectura del tabulador para la consola de operación (solo lectura; se cambia por migración).
create policy delivery_zones_select_ops on sales.delivery_zones
  for select to authenticated using (private.is_ops_console());
grant select on sales.delivery_zones to authenticated;
create view public.delivery_zones_list with (security_invoker = true) as
  select zone, up_to_km, courier_pay, margin, customer_fee from sales.delivery_zones;
revoke all on public.delivery_zones_list from public, anon;
grant select on public.delivery_zones_list to authenticated;

-- Datos que cada pedido conserva para liquidar después (no se exponen en las vistas de pedidos).
alter table sales.orders
  add column delivery_zone smallint,
  add column delivery_distance_km numeric(5, 1),
  add column courier_pay numeric(10, 2),
  add column delivery_margin numeric(10, 2);

-- Distancia en línea recta entre dos puntos, en km.
create or replace function private.haversine_km(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric)
returns numeric language sql immutable set search_path = '' as $$
  select (12742 * asin(sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )))::numeric;
$$;

-- Cotiza la entrega de una tienda a un punto. Lanza un error claro si falta una ubicación o si queda fuera de cobertura.
create or replace function private.delivery_quote(p_store uuid, p_latitude numeric, p_longitude numeric)
returns table (zone smallint, distance_km numeric, up_to_km numeric, customer_fee numeric, courier_pay numeric, margin numeric)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_s_lat numeric;
  v_s_lng numeric;
  v_km numeric;
  v_max numeric;
begin
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
  v_km := round(private.haversine_km(v_s_lat, v_s_lng, p_latitude, p_longitude) * (select ds.road_factor from sales.delivery_settings ds), 1);
  return query
    select z.zone, v_km, z.up_to_km, z.customer_fee, z.courier_pay, z.margin
    from sales.delivery_zones z where v_km <= z.up_to_km order by z.up_to_km limit 1;
  if not found then
    select max(z.up_to_km) into v_max from sales.delivery_zones z;
    raise exception 'tu punto de entrega queda a más de % km de la tienda: el envío no está disponible', trim_scale(v_max) using errcode = '22023';
  end if;
end $$;

-- Cotización para el checkout: devuelve la zona y el cobro, no la distancia (así no se puede ubicar la tienda tanteando puntos).
create or replace function public.quote_delivery(p_store uuid, p_latitude numeric, p_longitude numeric)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v record;
begin
  perform private.require_valid_session();
  if not private.has_role('cliente') then
    raise exception 'solo los clientes cotizan una entrega' using errcode = '42501';
  end if;
  select * into v from private.delivery_quote(p_store, p_latitude, p_longitude);
  return jsonb_build_object('zone', v.zone, 'up_to_km', v.up_to_km, 'fee', v.customer_fee);
end $$;

revoke all on function public.quote_delivery(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.quote_delivery(uuid, numeric, numeric) to authenticated;
revoke all on function private.delivery_quote(uuid, numeric, numeric), private.haversine_km(numeric, numeric, numeric, numeric) from public, anon, authenticated;

-- `create_order`: el pin del destino es obligatorio y el envío se cobra según la zona.
create or replace function public.create_order(
  p_store uuid, p_items jsonb, p_payment_method text, p_address text, p_phone text,
  p_notes text default null, p_client_ref uuid default null,
  p_latitude numeric default null, p_longitude numeric default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_quote record;
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

  -- Falla antes de reservar nada si falta alguna ubicación o el destino queda fuera de cobertura.
  select * into v_quote from private.delivery_quote(p_store, p_latitude, p_longitude);

  v_id := private.create_order_core(p_store, p_items, p_payment_method, p_address, p_phone, p_notes);
  if p_client_ref is not null then
    update sales.orders set client_ref = p_client_ref where id = v_id;
  end if;

  update sales.orders
     set delivery_fee = v_quote.customer_fee, total = subtotal + v_quote.customer_fee,
         delivery_zone = v_quote.zone, delivery_distance_km = v_quote.distance_km,
         courier_pay = v_quote.courier_pay, delivery_margin = v_quote.margin
   where id = v_id;
  update sales.order_delivery set latitude = p_latitude, longitude = p_longitude where order_id = v_id;
  perform private.write_audit('order.delivery_priced', 'order', v_id::text, null,
    jsonb_build_object('zone', v_quote.zone, 'delivery_fee', v_quote.customer_fee));
  return v_id;
end $$;
