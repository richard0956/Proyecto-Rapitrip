-- Entregas express y programadas, etapa 1 (parte 2): la clase del pedido se decide por producto y destino.
-- Diseño: docs/informe/2026-10-21-entregas-express-programado-design.md, sección 3.1.
--
-- Para cada tienda de la compra, el envío es EXPRESS solo si se cumplen las tres condiciones:
--   1. el producto puede ser express (elegible, dentro de los límites y fuera de categorías «solo programado»);
--   2. la distancia tienda -> destino cabe en la última zona de `sales.delivery_zones` (hoy 20 km);
--   3. la tienda y el destino están en el mismo departamento (si alguno de los dos es desconocido, no se aplica).
-- Lo demás es PROGRAMADO, con tarifa y plazo propios en `sales.programmed_bands`. Una misma tienda puede producir un envío
-- express y uno programado (productos pequeños y grandes con destino cercano).
--
-- `sales.programmed_bands` nace VACÍA: los plazos y precios los define la operación. Mientras no cubra la distancia del
-- pedido, un envío programado se rechaza con un mensaje claro (nunca se inventa un precio).

create table sales.programmed_bands (
  band smallint primary key check (band between 1 and 30),
  up_to_km numeric(6, 1) not null unique check (up_to_km > 0),
  min_days smallint not null check (min_days >= 0),
  max_days smallint not null,
  courier_pay numeric(10, 2) not null check (courier_pay >= 0),
  margin numeric(10, 2) not null check (margin >= 0),
  customer_fee numeric(10, 2) generated always as (courier_pay + margin) stored,
  check (max_days >= min_days)
);

alter table sales.programmed_bands enable row level security;
create policy programmed_bands_select_ops on sales.programmed_bands
  for select to authenticated using (private.is_ops_console());
grant select on sales.programmed_bands to authenticated;

create view public.programmed_bands_list with (security_invoker = true) as
  select band, up_to_km, min_days, max_days, courier_pay, margin, customer_fee from sales.programmed_bands;
revoke all on public.programmed_bands_list from public, anon;
grant select on public.programmed_bands_list to authenticated;

-- Evalúa la entrega de una tienda: distancia, clase de cada envío, tarifa y plazo.
-- p_items: [{"variant_id": "...", "quantity": 2}, ...]. Devuelve la distancia solo para uso interno (no se expone al cliente).
create or replace function private.delivery_assess(
  p_store uuid, p_items jsonb, p_latitude numeric, p_longitude numeric, p_department text, p_quote uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_store commerce.stores;
  v_quote sales.delivery_quotes;
  v_km numeric;
  v_method text;
  v_max_express numeric;
  v_max_kg numeric;
  v_route_ok boolean;
  v_route_reason text;
  v_line record;
  v_var record;
  v_express jsonb := '[]'::jsonb;
  v_prog jsonb := '[]'::jsonb;
  v_kg numeric := 0;
  v_prog_has_product boolean := false;
  v_validation int := 0;
  v_extra int := 0;
  v_shipments jsonb := '[]'::jsonb;
  v_zone record;
  v_band record;
begin
  if p_latitude is null or p_longitude is null then
    raise exception 'marca el punto de entrega en el mapa' using errcode = '22023';
  end if;
  if not private.valid_ni_point(p_latitude, p_longitude) then
    raise exception 'el punto de entrega debe estar dentro de Nicaragua' using errcode = '22023';
  end if;
  if p_department is not null and not exists (select 1 from sales.departments where code = p_department) then
    raise exception 'departamento no válido' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'el pedido debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;

  select * into v_store from commerce.stores where id = p_store;
  if not found then
    raise exception 'tienda no disponible' using errcode = 'P0002';
  end if;
  if v_store.latitude is null then
    raise exception 'esta tienda aún no tiene su ubicación en el mapa y no puede recibir pedidos a domicilio' using errcode = '22023';
  end if;

  -- Distancia: la cotización por ruta si viene (con las mismas validaciones de `create_order`); si no, la línea recta por el factor de ruta.
  if p_quote is not null then
    select * into v_quote from sales.delivery_quotes where id = p_quote and client_id = auth.uid();
    if not found or v_quote.expires_at < now() then
      raise exception 'la cotización del envío venció: marca de nuevo tu punto de entrega' using errcode = '22023';
    end if;
    if v_quote.store_id <> p_store or abs(v_quote.latitude - p_latitude) > 0.000002 or abs(v_quote.longitude - p_longitude) > 0.000002 then
      raise exception 'la cotización del envío no corresponde a ese punto de entrega' using errcode = '22023';
    end if;
    v_km := v_quote.distance_km;
    v_method := v_quote.method;
  else
    v_km := round(private.haversine_km(v_store.latitude, v_store.longitude, p_latitude, p_longitude)
                  * (select ds.road_factor from sales.delivery_settings ds), 1);
    v_method := 'linea_recta';
  end if;

  select max(z.up_to_km) into v_max_express from sales.delivery_zones z;
  select s.max_order_kg into v_max_kg from sales.delivery_class_settings s;

  if v_store.department is not null and p_department is not null and v_store.department <> p_department then
    v_route_ok := false;
    v_route_reason := 'otro_departamento';
  elsif v_km > v_max_express then
    v_route_ok := false;
    v_route_reason := 'distancia';
  else
    v_route_ok := true;
  end if;

  -- Reparto de los renglones entre el envío express y el programado.
  for v_line in
    select (e ->> 'variant_id') as vid, sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_line.qty is null or v_line.qty < 1 or v_line.qty > 99 then
      raise exception 'la cantidad de cada producto debe estar entre 1 y 99' using errcode = '22023';
    end if;
    select v.id, p.id as product_id, p.weight_kg, p.validation_days, private.product_express_ok(p.id) as express_ok
      into v_var
      from commerce.product_variants v
      join commerce.products p on p.id = v.product_id
     where v.id = v_line.vid::uuid and v.store_id = p_store and v.status = 'activa' and p.status = 'publicado';
    if not found then
      raise exception 'un producto del pedido ya no está disponible' using errcode = '22023';
    end if;

    if v_route_ok and v_var.express_ok then
      v_express := v_express || jsonb_build_object('variant_id', v_var.id, 'quantity', v_line.qty);
      v_kg := v_kg + coalesce(v_var.weight_kg, 0) * v_line.qty;
    else
      v_prog := v_prog || jsonb_build_object('variant_id', v_var.id, 'quantity', v_line.qty);
      if not v_var.express_ok then v_prog_has_product := true; end if;
      v_validation := greatest(v_validation, coalesce(v_var.validation_days, 0));
    end if;
  end loop;

  if jsonb_array_length(v_express) > 0 then
    if v_kg > v_max_kg then
      raise exception 'el envío express de % pesa más de % kg: reduce las cantidades', v_store.name, trim_scale(v_max_kg) using errcode = '22023';
    end if;
    select z.zone, z.customer_fee, z.courier_pay, z.margin into v_zone
      from sales.delivery_zones z where v_km <= z.up_to_km order by z.up_to_km limit 1;
    v_shipments := v_shipments || jsonb_build_object(
      'delivery_class', 'express', 'reason', null, 'items', v_express,
      'zone', v_zone.zone, 'band', null,
      'customer_fee', v_zone.customer_fee, 'courier_pay', v_zone.courier_pay, 'margin', v_zone.margin,
      'eta_min_days', null, 'eta_max_days', null);
  end if;

  if jsonb_array_length(v_prog) > 0 then
    select b.band, b.min_days, b.max_days, b.customer_fee, b.courier_pay, b.margin into v_band
      from sales.programmed_bands b where v_km <= b.up_to_km order by b.up_to_km limit 1;
    if not found then
      raise exception 'el envío programado a esa distancia aún no está disponible' using errcode = '22023';
    end if;
    if p_department is not null then
      select d.extra_days into v_extra from sales.departments d where d.code = p_department;
    end if;
    v_shipments := v_shipments || jsonb_build_object(
      'delivery_class', 'programado',
      'reason', case when v_prog_has_product then 'producto' else v_route_reason end,
      'items', v_prog,
      'zone', null, 'band', v_band.band,
      'customer_fee', v_band.customer_fee, 'courier_pay', v_band.courier_pay, 'margin', v_band.margin,
      'eta_min_days', v_band.min_days + coalesce(v_extra, 0) + v_validation,
      'eta_max_days', v_band.max_days + coalesce(v_extra, 0) + v_validation);
  end if;

  return jsonb_build_object('distance_km', v_km, 'method', v_method,
    'origin_department', v_store.department, 'destination_department', p_department, 'shipments', v_shipments);
end $$;

revoke all on function private.delivery_assess(uuid, jsonb, numeric, numeric, text, uuid) from public, anon, authenticated;

-- Cotización para el checkout: cuántos envíos salen de esa tienda, de qué clase, a qué precio y en cuántos días.
-- No devuelve la distancia (así no sirve para ubicar la tienda tanteando puntos) ni el pago al repartidor ni el margen.
create or replace function public.quote_delivery_group(
  p_store uuid, p_items jsonb, p_latitude numeric, p_longitude numeric, p_department text default null, p_quote_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v jsonb;
begin
  perform private.require_valid_session();
  if not private.has_role('cliente') then
    raise exception 'solo los clientes cotizan una entrega' using errcode = '42501';
  end if;
  v := private.delivery_assess(p_store, p_items, p_latitude, p_longitude, p_department, p_quote_id);
  return jsonb_build_object(
    'origin_department', v -> 'origin_department',
    'destination_department', v -> 'destination_department',
    'shipments', (select coalesce(jsonb_agg(s - 'courier_pay' - 'margin'), '[]'::jsonb) from jsonb_array_elements(v -> 'shipments') s));
end $$;

revoke all on function public.quote_delivery_group(uuid, jsonb, numeric, numeric, text, uuid) from public, anon, authenticated;
grant execute on function public.quote_delivery_group(uuid, jsonb, numeric, numeric, text, uuid) to authenticated;
