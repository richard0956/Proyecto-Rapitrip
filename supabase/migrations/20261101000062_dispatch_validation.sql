-- Entregas express y programadas, etapa 6: despacho por vehículo y departamento, estado «en validación» y reclasificación.
-- Diseño: docs/informe/2026-10-21-entregas-express-programado-design.md.
--
--   * Despacho: un pedido programado solo lo lleva un repartidor con vehículo que trabaje en el departamento de la tienda;
--     uno express lo puede llevar cualquiera (moto, vehículo o un repartidor aún sin clasificar). Lo exige `assign_order_courier`.
--   * Validación: un pedido programado puede pasar de «por confirmar» a «en validación» (el comercio revisa disponibilidad, armado o
--     proveedor) antes de confirmarse. Cada etapa tiene su plazo: 24 horas para responder y, en validación, los días máximos de la
--     entrega. Si nadie responde, el pedido vence y se devuelve el stock (y el pago, si lo hubo). El stock sigue reservándose al
--     crear el pedido: así no se vende dos veces mientras se valida.
--   * Reclasificación: coordinación puede pasar a programado un pedido express que el repartidor ve que no cabe en una moto, con
--     motivo y auditoría. Se conserva lo que pagó el cliente; el pago al repartidor y el plazo salen del tramo programado.

alter table sales.orders drop constraint orders_status_check;
alter table sales.orders add constraint orders_status_check check (status in
  ('pendiente_pago', 'por_confirmar', 'en_validacion', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado', 'rechazado'));

alter table sales.orders
  add column reclassified_by uuid,
  add column reclassified_at timestamptz,
  add column reclassified_reason text check (reclassified_reason is null or char_length(reclassified_reason) between 5 and 200);

-- Estados y plazos ------------------------------------------------------------------------------------------------------

create or replace function public.set_order_status(p_order uuid, p_to text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_coord boolean;
  v_shop boolean;
  v_client boolean;
  v_allowed boolean := false;
  v_reason text := nullif(btrim(p_reason), '');
begin
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if p_to is null or p_to not in ('en_validacion', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado', 'rechazado') then
    raise exception 'estado no válido' using errcode = '22023';
  end if;
  if v_order.status in ('entregado', 'cancelado', 'rechazado') then
    raise exception 'el pedido ya terminó y no admite cambios' using errcode = '22023';
  end if;

  v_client := v_order.client_id = auth.uid() and private.has_valid_session();
  v_coord := private.is_coordination_console();
  v_shop := private.has_role('comercio', v_order.commerce_id) and private.has_strong_session();
  if not (v_client or v_coord or v_shop) then
    raise exception 'no puedes cambiar este pedido' using errcode = '42501';
  end if;

  if p_to in ('cancelado', 'rechazado') and (v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 200) then
    raise exception 'indica el motivo (entre 5 y 200 caracteres)' using errcode = '22023';
  end if;

  if p_to = 'cancelado' then
    v_allowed := (v_client and v_order.status in ('pendiente_pago', 'por_confirmar', 'en_validacion'))
              or (v_shop and v_order.status in ('por_confirmar', 'en_validacion', 'confirmado', 'preparando'))
              or v_coord;
  elsif p_to = 'rechazado' then
    v_allowed := (v_shop or v_coord) and v_order.status in ('por_confirmar', 'en_validacion');
  elsif p_to = 'en_validacion' then
    -- Solo los pedidos programados pasan por validación: el comercio los revisa (disponibilidad, armado, proveedor) antes de confirmar.
    v_allowed := (v_shop or v_coord) and v_order.status = 'por_confirmar' and v_order.delivery_class = 'programado';
  elsif p_to = 'confirmado' then
    v_allowed := (v_shop or v_coord) and v_order.status in ('por_confirmar', 'en_validacion');
  elsif p_to = 'preparando' then
    v_allowed := (v_shop or v_coord) and v_order.status = 'confirmado';
  elsif p_to = 'listo' then
    v_allowed := (v_shop or v_coord) and v_order.status = 'preparando';
  elsif p_to = 'en_camino' then
    v_allowed := v_coord and v_order.status = 'listo';
    if v_allowed and v_order.courier_id is null then
      raise exception 'asigna un repartidor antes de despachar el pedido' using errcode = '22023';
    end if;
  elsif p_to = 'entregado' then
    v_allowed := v_coord and v_order.status = 'en_camino';
  end if;
  if not v_allowed then
    raise exception 'ese cambio de estado no está permitido' using errcode = '42501';
  end if;

  update sales.orders set
    status = p_to,
    status_reason = case when p_to in ('cancelado', 'rechazado') then v_reason else status_reason end,
    -- En validación el pedido tiene como plazo los días máximos de su entrega (mínimo uno); si nadie lo valida, vence.
    expires_at = case when p_to = 'en_validacion' then now() + make_interval(days => greatest(coalesce(v_order.eta_max_days, 1), 1)) else null end,
    updated_at = now(),
    confirmed_at = case when p_to = 'confirmado' then now() else confirmed_at end,
    delivered_at = case when p_to = 'entregado' then now() else delivered_at end,
    payment_status = case when p_to = 'entregado' and payment_method = 'efectivo' then 'pagado' else payment_status end
  where id = p_order;

  if p_to in ('cancelado', 'rechazado') then
    perform private.release_order_stock(p_order, 'Pedido ' || v_order.number || ' ' || p_to);
  end if;
  insert into sales.order_events (order_id, from_status, to_status, reason, actor_id)
  values (p_order, v_order.status, p_to, v_reason, auth.uid());
  perform private.write_audit('order.' || p_to, 'order', p_order::text,
    jsonb_build_object('status', v_order.status), jsonb_build_object('status', p_to), v_reason);
end $$;

create or replace function private.expire_stale_orders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r sales.orders;
  v_count int := 0;
begin
  for r in
    select * from sales.orders
     where status in ('pendiente_pago', 'por_confirmar', 'en_validacion') and expires_at is not null and expires_at <= now()
     order by expires_at
     for update skip locked
  loop
    update sales.orders set status = 'cancelado', status_reason = case when r.status = 'en_validacion' then 'validación vencida' else 'vencido sin respuesta' end,
           expires_at = null, updated_at = now() where id = r.id;
    perform private.release_order_stock(r.id, 'Pedido ' || r.number || ' vencido');
    insert into sales.order_events (order_id, from_status, to_status, reason)
    values (r.id, r.status, 'cancelado', case when r.status = 'en_validacion' then 'validación vencida' else 'vencido sin respuesta' end);
    perform private.write_audit('order.expired', 'order', r.id::text, jsonb_build_object('status', r.status));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- Un pedido pagado con tarjeta espera al comercio 24 horas si es programado y 45 minutos si es express.
create or replace function public.mark_order_paid(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order sales.orders;
begin
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.payment_method <> 'tarjeta' or v_order.status <> 'pendiente_pago' then
    raise exception 'el pedido no espera un pago' using errcode = '22023';
  end if;
  update sales.orders set status = 'por_confirmar', payment_status = 'pagado',
         expires_at = now() + case when delivery_class = 'programado' then interval '24 hours' else interval '45 minutes' end, updated_at = now(),
         cash_session_id = (select s.id from sales.cash_sessions s where s.closed_at is null order by s.opened_at desc limit 1)
   where id = p_order;
  insert into sales.order_events (order_id, from_status, to_status, reason)
  values (p_order, 'pendiente_pago', 'por_confirmar', 'pago recibido');
  perform private.write_audit('order.paid', 'order', p_order::text);
end $$;

-- `create_checkout`: un programado en efectivo da 24 horas al comercio para responder (el resto de la función no cambia).
create or replace function public.create_checkout(
  p_groups jsonb, p_payment_method text, p_address text, p_phone text,
  p_notes text default null, p_client_ref uuid default null,
  p_latitude numeric default null, p_longitude numeric default null, p_department text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_checkout uuid;
  v_group jsonb;
  v_assess jsonb;
  v_ship jsonb;
  v_store uuid;
  v_stores uuid[] := '{}';
  v_store_name text;
  v_order uuid;
  v_o sales.orders;
  v_total numeric(12, 2) := 0;
  v_count int := 0;
begin
  perform private.require_valid_session();
  if not private.has_role('cliente') then
    raise exception 'solo los clientes pueden hacer pedidos' using errcode = '42501';
  end if;
  if p_payment_method is null or p_payment_method not in ('tarjeta', 'efectivo') then
    raise exception 'elige un método de pago válido' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'marca el punto de entrega en el mapa' using errcode = '22023';
  end if;
  if not private.valid_ni_point(p_latitude, p_longitude) then
    raise exception 'el punto de entrega debe estar dentro de Nicaragua' using errcode = '22023';
  end if;
  if p_department is not null and not exists (select 1 from sales.departments where code = p_department) then
    raise exception 'departamento no válido' using errcode = '22023';
  end if;
  if p_groups is null or jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) not between 1 and 4 then
    raise exception 'la compra debe tener entre 1 y 4 tiendas' using errcode = '22023';
  end if;
  for v_group in select value from jsonb_array_elements(p_groups) loop
    v_store := (v_group ->> 'store_id')::uuid;
    if v_store is null then
      raise exception 'cada grupo de la compra necesita su tienda' using errcode = '22023';
    end if;
    if v_store = any (v_stores) then
      raise exception 'una tienda aparece dos veces en la compra' using errcode = '22023';
    end if;
    v_stores := array_append(v_stores, v_store);
  end loop;

  if p_client_ref is not null then
    -- Mismo patrón que `create_order`: un reintento con la misma referencia devuelve la compra ya creada.
    perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':checkout:' || p_client_ref::text, 0));
    select id into v_checkout from sales.checkouts where client_id = auth.uid() and client_ref = p_client_ref;
    if found then
      return private.checkout_result(v_checkout);
    end if;
  end if;

  insert into sales.checkouts (client_id, client_ref, payment_method)
  values (auth.uid(), p_client_ref, p_payment_method)
  returning id into v_checkout;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    v_store := (v_group ->> 'store_id')::uuid;
    select name into v_store_name from commerce.stores where id = v_store;
    if not found then
      raise exception 'tienda no disponible' using errcode = 'P0002';
    end if;
    begin
      v_assess := private.delivery_assess(v_store, v_group -> 'items', p_latitude, p_longitude, p_department,
                                          nullif(v_group ->> 'quote_id', '')::uuid);
      for v_ship in select value from jsonb_array_elements(v_assess -> 'shipments') loop
        v_order := private.create_order_core(v_store, v_ship -> 'items', p_payment_method, p_address, p_phone, p_notes);
        update sales.orders
           set checkout_id = v_checkout,
               delivery_fee = (v_ship ->> 'customer_fee')::numeric,
               total = subtotal + (v_ship ->> 'customer_fee')::numeric,
               delivery_class = v_ship ->> 'delivery_class',
               class_reason = v_ship ->> 'reason',
               delivery_zone = (v_ship ->> 'zone')::smallint,
               delivery_band = (v_ship ->> 'band')::smallint,
               delivery_distance_km = (v_assess ->> 'distance_km')::numeric,
               delivery_method = v_assess ->> 'method',
               courier_pay = (v_ship ->> 'courier_pay')::numeric,
               delivery_margin = (v_ship ->> 'margin')::numeric,
               origin_department = nullif(v_assess ->> 'origin_department', ''),
               destination_department = nullif(v_assess ->> 'destination_department', ''),
               eta_min_days = (v_ship ->> 'eta_min_days')::smallint,
               eta_max_days = (v_ship ->> 'eta_max_days')::smallint,
               -- Un programado en efectivo da 24 horas al comercio para responder (un express, 45 minutos).
               expires_at = case when v_ship ->> 'delivery_class' = 'programado' and p_payment_method = 'efectivo' then now() + interval '24 hours' else expires_at end
         where id = v_order
         returning * into v_o;
        update sales.order_delivery set latitude = p_latitude, longitude = p_longitude where order_id = v_order;
        perform private.write_audit('order.delivery_priced', 'order', v_order::text, null,
          jsonb_build_object('class', v_o.delivery_class, 'delivery_fee', v_o.delivery_fee, 'method', v_o.delivery_method));
        v_total := v_total + v_o.total;
        v_count := v_count + 1;
      end loop;
    exception when others then
      -- Todo o nada: el mensaje dice qué tienda impidió la compra.
      raise exception '%: %', v_store_name, sqlerrm using errcode = sqlstate;
    end;
  end loop;

  -- Con tarjeta y varios pedidos, la compra se paga de una vez (una sola sesión de Stripe); con un pedido se paga el pedido.
  update sales.checkouts
     set total = v_total, order_count = v_count,
         payment_status = case when p_payment_method = 'tarjeta' and v_count > 1 then 'pendiente' else 'no_aplica' end
   where id = v_checkout;
  perform private.write_audit('checkout.created', 'checkout', v_checkout::text, null,
    jsonb_build_object('orders', v_count, 'total', v_total));
  return private.checkout_result(v_checkout);
end $$;

-- Despacho ---------------------------------------------------------------------------------------------------------------

-- ¿Puede este repartidor llevar este pedido? Falla con un mensaje claro si no.
create or replace function private.assert_courier_fits(p_order sales.orders, p_courier uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v_courier identity.couriers;
begin
  select * into v_courier from identity.couriers where id = p_courier and status = 'activo';
  if not found then
    raise exception 'repartidor no disponible' using errcode = 'P0002';
  end if;
  if p_order.delivery_class = 'programado' then
    if v_courier.vehicle_class is distinct from 'vehiculo' then
      raise exception 'este pedido es programado: solo lo lleva un repartidor con vehículo' using errcode = '22023';
    end if;
    if p_order.origin_department is not null and v_courier.department is distinct from p_order.origin_department then
      raise exception 'el repartidor debe trabajar en el departamento de la tienda' using errcode = '22023';
    end if;
  end if;
end $$;

create or replace function public.assign_order_courier(p_order uuid, p_courier uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order sales.orders;
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes asignar repartidores' using errcode = '42501';
  end if;
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.status not in ('confirmado', 'preparando', 'listo', 'en_camino') then
    raise exception 'solo se asigna repartidor a pedidos confirmados y en curso' using errcode = '22023';
  end if;
  perform private.assert_courier_fits(v_order, p_courier);
  update sales.orders set courier_id = p_courier, updated_at = now() where id = p_order;
  perform private.write_audit('order.courier_assigned', 'order', p_order::text, null,
    jsonb_build_object('courier_id', p_courier, 'delivery_class', v_order.delivery_class));
end $$;

-- Reclasificación --------------------------------------------------------------------------------------------------------

create or replace function public.reclassify_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_reason text := nullif(btrim(p_reason), '');
  v_band record;
  v_extra int := 0;
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes reclasificar pedidos' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) not between 5 and 200 then
    raise exception 'indica el motivo (entre 5 y 200 caracteres)' using errcode = '22023';
  end if;
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.delivery_class <> 'express' then
    raise exception 'el pedido ya es programado' using errcode = '22023';
  end if;
  if v_order.status not in ('por_confirmar', 'confirmado', 'preparando', 'listo') then
    raise exception 'solo se reclasifica un pedido que todavía no salió' using errcode = '22023';
  end if;

  -- Tramo programado de la distancia del pedido, si ya existe: de él salen el pago al repartidor y el plazo.
  select b.band, b.min_days, b.max_days, b.courier_pay into v_band
    from sales.programmed_bands b where coalesce(v_order.delivery_distance_km, 0) <= b.up_to_km order by b.up_to_km limit 1;
  if found and v_order.destination_department is not null then
    select d.extra_days into v_extra from sales.departments d where d.code = v_order.destination_department;
  end if;

  update sales.orders set
    delivery_class = 'programado',
    class_reason = 'producto',
    delivery_zone = null,
    delivery_band = v_band.band,
    -- Quien iba a llevarlo en moto ya no sirve: coordinación asigna un repartidor con vehículo.
    courier_id = null,
    courier_pay = coalesce(v_band.courier_pay, courier_pay),
    delivery_margin = case when v_band.band is not null then delivery_fee - v_band.courier_pay else delivery_margin end,
    eta_min_days = case when v_band.band is not null then v_band.min_days + coalesce(v_extra, 0) end,
    eta_max_days = case when v_band.band is not null then v_band.max_days + coalesce(v_extra, 0) end,
    expires_at = case when status = 'por_confirmar' then now() + interval '24 hours' else expires_at end,
    reclassified_by = auth.uid(),
    reclassified_at = now(),
    reclassified_reason = v_reason,
    updated_at = now()
  where id = p_order;
  perform private.write_audit('order.reclassified', 'order', p_order::text,
    jsonb_build_object('delivery_class', 'express', 'courier_id', v_order.courier_id),
    jsonb_build_object('delivery_class', 'programado', 'band', v_band.band), v_reason);
end $$;

-- Vistas -----------------------------------------------------------------------------------------------------------------

create or replace view public.orders_list with (security_invoker = true) as
  select o.id, o.number, o.client_id, o.store_id, o.store_name, o.commerce_id, o.status, o.payment_method,
         o.payment_status, o.subtotal, o.delivery_fee, o.total, o.courier_id, o.status_reason, o.expires_at,
         o.created_at, o.updated_at, o.confirmed_at, o.delivered_at,
         (select coalesce(sum(i.quantity), 0) from sales.order_items i where i.order_id = o.id) as item_count,
         o.channel, o.cashier_id, o.cash_session_id,
         o.payment_ref, o.cash_received_at,
         o.checkout_id, o.delivery_class, o.class_reason, o.origin_department, o.destination_department,
         o.eta_min_days, o.eta_max_days,
         o.reclassified_at, o.reclassified_reason
  from sales.orders o;

-- Cuántos pedidos express de cada comercio tuvo que reclasificar coordinación (últimos 30 días): si un comercio marca como
-- express lo que no cabe en una moto, aquí se nota.
create view public.commerce_reclassification_stats with (security_invoker = true) as
  select o.commerce_id,
         count(*) filter (where o.reclassified_at is not null) as reclassified,
         count(*) filter (where o.delivery_class = 'express' or o.reclassified_at is not null) as express_total
  from sales.orders o
  where o.created_at >= now() - interval '30 days' and o.channel = 'web' and private.is_coordination_console()
  group by o.commerce_id;

revoke all on public.commerce_reclassification_stats from public, anon;
grant select on public.commerce_reclassification_stats to authenticated;

revoke all on function private.assert_courier_fits(sales.orders, uuid) from public, anon, authenticated;
revoke all on function public.assign_order_courier(uuid, uuid), public.reclassify_order(uuid, text) from public, anon, authenticated;
grant execute on function public.assign_order_courier(uuid, uuid), public.reclassify_order(uuid, text) to authenticated;
