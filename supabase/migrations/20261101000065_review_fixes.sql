-- Correcciones de la revisión de código de las etapas 1 a 7.
--   1. Pago de la compra: un pedido cancelado entre dos sesiones de pago conservaba el monto de la sesión vieja y, al llegar el pago,
--      se «reembolsaba» dinero que nunca se cobró.
--   2. El tope de 5 pedidos sin resolver contaba los pedidos de la propia compra: una compra de 6 a 8 entregas fallaba sin motivo.
--   3. Despachar vuelve a comprobar que el repartidor sirve para el pedido.
--   4. La clase de vehículo de los repartidores existentes se reclasifica con palabras completas.

-- Clase de vehículo a partir del texto libre de la ficha del repartidor. Reconoce palabras completas (no trozos como «van» dentro
-- de «avanzado») y deja sin clase lo ambiguo o negado («a pie», «sin vehículo»), para que la administración lo asigne.
create or replace function private.guess_vehicle_class(p_text text)
returns text language sql immutable set search_path = '' as $$
  select case
    when t.v ~ '\m(sin|no|pie|bici|bicicleta|caminando)\M' then null
    when t.v ~ 'moto' then 'moto'
    when t.v ~ '\m(carro|auto|camion|camioneta|pickup|pick-up|vehiculo|furgon|furgoneta|van|microbus)\M' then 'vehiculo'
  end
  from (select translate(lower(coalesce(p_text, '')), 'áéíóúü', 'aeiouu') as v) t;
$$;
revoke all on function private.guess_vehicle_class(text) from public, anon, authenticated;

-- Repartidores que la migración 57 pudo clasificar de más («a pie, sin vehículo», «avanzado»): vuelven a la clase que dicen sus palabras.
update identity.couriers set vehicle_class = private.guess_vehicle_class(vehicle_type)
 where vehicle_class = 'vehiculo' and private.guess_vehicle_class(vehicle_type) is distinct from 'vehiculo';

-- 1) ----------------------------------------------------------------------------------------------------------------
create or replace function public.record_checkout_payment_session(p_checkout uuid, p_session text, p_currency text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_checkout sales.checkouts;
  v_amount bigint;
  v_pending int;
begin
  if p_session is null or p_session !~ '^cs_[A-Za-z0-9_]{8,200}$' then
    raise exception 'sesión de pago inválida' using errcode = '22023';
  end if;
  if p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
    raise exception 'moneda inválida' using errcode = '22023';
  end if;
  select * into v_checkout from sales.checkouts where id = p_checkout for update;
  if not found then
    raise exception 'compra no encontrada' using errcode = 'P0002';
  end if;
  if v_checkout.payment_method <> 'tarjeta' or v_checkout.payment_status <> 'pendiente' then
    raise exception 'la compra no espera un pago' using errcode = '22023';
  end if;
  perform 1 from sales.orders where checkout_id = p_checkout order by number for update;
  select count(*), coalesce(sum(round(o.total * 100)), 0)::bigint into v_pending, v_amount
    from sales.orders o where o.checkout_id = p_checkout and o.status = 'pendiente_pago';
  if v_pending = 0 then
    raise exception 'la compra no tiene pedidos esperando pago' using errcode = '22023';
  end if;
  update sales.orders
     set payment_amount = round(total * 100)::bigint, payment_currency = lower(p_currency), updated_at = now()
   where checkout_id = p_checkout and status = 'pendiente_pago';
  -- Un pedido que dejó de esperar pago desde una sesión anterior (lo canceló el cliente) no entra en este cobro: sin esto conservaría
  -- el monto de la sesión vieja y, al llegar el pago, se «devolvería» dinero que nunca se cobró.
  update sales.orders set payment_amount = null, payment_currency = null
   where checkout_id = p_checkout and status <> 'pendiente_pago' and payment_amount is not null;
  update sales.checkouts
     set payment_session_id = p_session, payment_amount = v_amount, payment_currency = lower(p_currency)
   where id = p_checkout;
  perform private.write_audit('checkout.payment_session_created', 'checkout', p_checkout::text, null,
    jsonb_build_object('amount', v_amount, 'currency', lower(p_currency), 'orders', v_pending));
  return jsonb_build_object('previous_session', v_checkout.payment_session_id, 'amount', v_amount);
end $$;

-- 2) ----------------------------------------------------------------------------------------------------------------
drop function private.create_order_core(uuid, jsonb, text, text, text, text);
create or replace function private.create_order_core(
  p_store uuid, p_items jsonb, p_payment_method text, p_address text, p_phone text, p_notes text default null,
  p_enforce_limit boolean default true
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_store commerce.stores;
  v_order sales.orders;
  v_item record;
  v_var record;
  v_inv commerce.inventory;
  v_subtotal numeric(12, 2) := 0;
  v_status text;
  v_expires timestamptz;
  v_label text;
  v_reserved boolean;
begin
  perform private.require_valid_session();
  if not private.has_role('cliente') then
    raise exception 'solo los clientes pueden hacer pedidos' using errcode = '42501';
  end if;
  if p_payment_method is null or p_payment_method not in ('tarjeta', 'efectivo') then
    raise exception 'elige un método de pago válido' using errcode = '22023';
  end if;
  if p_address is null or char_length(btrim(p_address)) not between 5 and 240 then
    raise exception 'la dirección de entrega debe tener entre 5 y 240 caracteres' using errcode = '22023';
  end if;
  if p_phone is null or p_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'teléfono inválido' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 240 then
    raise exception 'las notas son demasiado largas' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'el pedido debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;
  if p_enforce_limit and (select count(*) from sales.orders
       where client_id = auth.uid() and status in ('pendiente_pago', 'por_confirmar')) >= 5 then
    raise exception 'tienes demasiados pedidos sin resolver: espera a que se confirmen o cancélalos' using errcode = '22023';
  end if;

  select * into v_store from commerce.stores where id = p_store;
  if not found or not exists (select 1 from identity.commerces where id = v_store.commerce_id and status = 'activo') then
    raise exception 'tienda no disponible' using errcode = 'P0002';
  end if;
  if not private.store_open_at(v_store) then
    raise exception 'la tienda está cerrada en este momento' using errcode = '22023';
  end if;

  v_status := case p_payment_method when 'tarjeta' then 'pendiente_pago' else 'por_confirmar' end;
  v_expires := now() + case p_payment_method when 'tarjeta' then interval '30 minutes' else interval '45 minutes' end;

  insert into sales.orders (client_id, store_id, commerce_id, store_name, status, payment_method, subtotal, delivery_fee, total, expires_at)
  values (auth.uid(), p_store, v_store.commerce_id, v_store.name, v_status, p_payment_method, 0, v_store.delivery_fee, 0, v_expires)
  returning * into v_order;
  v_label := 'Pedido ' || v_order.number;

  -- Un renglón por variante; el orden fijo evita bloqueos cruzados entre pedidos simultáneos.
  for v_item in
    select (e ->> 'variant_id') as vid, sum((e ->> 'quantity')::int)::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_item.qty is null or v_item.qty < 1 or v_item.qty > 99 then
      raise exception 'la cantidad de cada producto debe estar entre 1 y 99' using errcode = '22023';
    end if;
    select v.id, v.name as variant_name, v.sku, v.price, p.name as product_name
      into v_var
      from commerce.product_variants v
      join commerce.products p on p.id = v.product_id
     where v.id = v_item.vid::uuid and v.store_id = p_store and v.status = 'activa' and p.status = 'publicado';
    if not found then
      raise exception 'un producto del pedido ya no está disponible' using errcode = '22023';
    end if;

    v_reserved := false;
    select * into v_inv from commerce.inventory where variant_id = v_var.id for update;
    if found and v_inv.track_stock then
      if v_inv.quantity < v_item.qty then
        raise exception 'no hay suficientes unidades de %: quedan %', v_var.product_name, v_inv.quantity using errcode = '22023';
      end if;
      update commerce.inventory set quantity = quantity - v_item.qty, updated_at = now() where variant_id = v_var.id;
      insert into commerce.stock_movements (variant_id, store_id, kind, delta, quantity_after, reason, created_by)
      values (v_var.id, p_store, 'salida', -v_item.qty, v_inv.quantity - v_item.qty, v_label, auth.uid());
      v_reserved := true;
    end if;

    insert into sales.order_items (order_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total, stock_reserved)
    values (v_order.id, v_var.id, v_var.product_name, v_var.variant_name, v_var.sku, v_var.price, v_item.qty, v_var.price * v_item.qty, v_reserved);
    v_subtotal := v_subtotal + v_var.price * v_item.qty;
  end loop;

  update sales.orders set subtotal = v_subtotal, total = v_subtotal + v_store.delivery_fee where id = v_order.id;
  insert into sales.order_delivery (order_id, address, phone, notes)
  values (v_order.id, btrim(p_address), p_phone, nullif(btrim(p_notes), ''));
  insert into sales.order_events (order_id, from_status, to_status, actor_id) values (v_order.id, null, v_status, auth.uid());

  perform private.write_audit('order.created', 'order', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'store_id', p_store, 'total', v_subtotal + v_store.delivery_fee,
                       'payment_method', p_payment_method));
  return v_order.id;
end $$;

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

  -- El tope de pedidos sin resolver se comprueba una vez, sobre lo que el cliente ya tenía abierto: una compra grande (hasta 8 pedidos)
  -- no debe fallar por contarse a sí misma.
  if (select count(*) from sales.orders where client_id = auth.uid() and status in ('pendiente_pago', 'por_confirmar')) >= 5 then
    raise exception 'tienes demasiados pedidos sin resolver: espera a que se confirmen o cancélalos' using errcode = '22023';
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
        v_order := private.create_order_core(v_store, v_ship -> 'items', p_payment_method, p_address, p_phone, p_notes, false);
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

-- 3) ----------------------------------------------------------------------------------------------------------------
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
    -- Su clase o su departamento pudieron cambiar después de asignarlo.
    if v_allowed then
      perform private.assert_courier_fits(v_order, v_order.courier_id);
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

-- Privilegios
revoke all on function private.create_order_core(uuid, jsonb, text, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.record_checkout_payment_session(uuid, text, text), public.create_checkout(jsonb, text, text, text, text, uuid, numeric, numeric, text),
  public.set_order_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.record_checkout_payment_session(uuid, text, text) to service_role;
grant execute on function public.create_checkout(jsonb, text, text, text, text, uuid, numeric, numeric, text), public.set_order_status(uuid, text, text) to authenticated;
