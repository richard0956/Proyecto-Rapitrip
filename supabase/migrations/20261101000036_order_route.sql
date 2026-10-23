-- Mapas: tienda y destino de un pedido, juntos.
--
-- Coordinación y administración ven los dos puntos (para dibujar la ruta). El comercio NO: el destino exacto del cliente es un
-- dato personal que el comercio nunca lee (ni la dirección ni el pin). Al comercio solo se le da la distancia en línea recta,
-- redondeada a 0,1 km, que no permite ubicar el punto.

-- Puntos de la ruta de un pedido: nombre y coordenadas de la tienda y del destino (nulas si falta alguna).
create or replace function public.order_route_points(p_order uuid)
returns table (store_name text, store_latitude numeric, store_longitude numeric, dest_latitude numeric, dest_longitude numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_coordination_console() then
    raise exception 'no puedes ver la ruta de este pedido' using errcode = '42501';
  end if;
  return query
    select o.store_name, s.latitude, s.longitude, d.latitude, d.longitude
    from sales.orders o
    join commerce.stores s on s.id = o.store_id
    left join sales.order_delivery d on d.order_id = o.id
    where o.id = p_order;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
end $$;

-- Distancia en línea recta entre la tienda y el destino, en km con un decimal; nula si falta alguna ubicación.
create or replace function public.order_distance_km(p_order uuid)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  v_commerce uuid;
  v_s_lat numeric; v_s_lng numeric; v_d_lat numeric; v_d_lng numeric;
begin
  select o.commerce_id, s.latitude, s.longitude, d.latitude, d.longitude
    into v_commerce, v_s_lat, v_s_lng, v_d_lat, v_d_lng
    from sales.orders o
    join commerce.stores s on s.id = o.store_id
    left join sales.order_delivery d on d.order_id = o.id
   where o.id = p_order;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if not (private.is_coordination_console() or (private.has_role('comercio', v_commerce) and private.has_strong_session())) then
    raise exception 'no puedes ver la distancia de este pedido' using errcode = '42501';
  end if;
  if v_s_lat is null or v_d_lat is null then
    return null;
  end if;
  -- Haversine con radio medio de la Tierra.
  return round((12742 * asin(sqrt(
      power(sin(radians(v_d_lat - v_s_lat) / 2), 2)
      + cos(radians(v_s_lat)) * cos(radians(v_d_lat)) * power(sin(radians(v_d_lng - v_s_lng) / 2), 2)
  )))::numeric, 1);
end $$;

revoke all on function public.order_route_points(uuid), public.order_distance_km(uuid) from public, anon, authenticated;
grant execute on function public.order_route_points(uuid), public.order_distance_km(uuid) to authenticated;
