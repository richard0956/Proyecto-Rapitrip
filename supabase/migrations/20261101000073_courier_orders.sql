-- Repartidor, etapa 2: lectura de sus pedidos y núcleo compartido de transiciones.
-- Diseño: docs/informe/2026-10-23-repartidor-revision-evidencias-y-consolas.md (etapa 2).
--
--   * `private.apply_order_transition` es el tramo de `set_order_status` que cambia el pedido (estado, plazos, stock, línea de
--     tiempo, auditoría). La autorización sigue en cada llamador: `set_order_status` (cliente, comercio, coordinación) y, en la
--     etapa 5, las funciones del repartidor. El comportamiento de `set_order_status` no cambia.
--   * El repartidor NO lee `sales.orders`: los permisos de esa tabla son por tabla entera (incluirían el margen y el pago de
--     envío). Lee solo lo que devuelven estas funciones, con columnas fijas y filtradas por su propia ficha.
--   * Los datos personales del cliente (dirección, teléfono, nota, punto en el mapa, nombre de pila) solo salen mientras el
--     pedido es suyo y está `listo` o `en_camino`. Al entregarse, desaparecen de su vista.

-- Núcleo de transiciones ------------------------------------------------------------------------------------------------

create or replace function private.apply_order_transition(p_order sales.orders, p_to text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update sales.orders set
    status = p_to,
    status_reason = case when p_to in ('cancelado', 'rechazado') then p_reason else status_reason end,
    -- En validación el pedido tiene como plazo los días máximos de su entrega (mínimo uno); si nadie lo valida, vence.
    expires_at = case when p_to = 'en_validacion' then now() + make_interval(days => greatest(coalesce(p_order.eta_max_days, 1), 1)) else null end,
    updated_at = now(),
    confirmed_at = case when p_to = 'confirmado' then now() else confirmed_at end,
    delivered_at = case when p_to = 'entregado' then now() else delivered_at end,
    payment_status = case when p_to = 'entregado' and payment_method = 'efectivo' then 'pagado' else payment_status end
  where id = p_order.id;

  if p_to in ('cancelado', 'rechazado') then
    perform private.release_order_stock(p_order.id, 'Pedido ' || p_order.number || ' ' || p_to);
  end if;
  insert into sales.order_events (order_id, from_status, to_status, reason, actor_id)
  values (p_order.id, p_order.status, p_to, p_reason, auth.uid());
  perform private.write_audit('order.' || p_to, 'order', p_order.id::text,
    jsonb_build_object('status', p_order.status), jsonb_build_object('status', p_to), p_reason);
end $$;

revoke all on function private.apply_order_transition(sales.orders, text, text) from public, anon, authenticated;

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

  perform private.apply_order_transition(v_order, p_to, v_reason);
end $$;

-- Lectura del repartidor ------------------------------------------------------------------------------------------------

-- Pedidos asignados al repartidor de la sesión que siguen abiertos, más los entregados hoy (hora de Managua).
-- Primero lo más urgente: en camino, listo, preparando, confirmado y, al final, lo ya entregado.
create or replace function public.courier_orders()
returns table (
  order_id uuid, number bigint, status text, delivery_class text,
  store_name text, store_address text, store_phone text,
  payment_method text, cash_total numeric, cash_registered boolean, item_count bigint,
  eta_max_days smallint, destination_department text,
  assigned_updated_at timestamptz, delivered_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v_today timestamptz := date_trunc('day', now() at time zone 'America/Managua') at time zone 'America/Managua';
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa ve sus pedidos' using errcode = '42501';
  end if;
  return query
    select o.id, o.number, o.status, o.delivery_class,
           o.store_name, s.address, s.contact_phone,
           o.payment_method,
           case when o.payment_method = 'efectivo' then o.total end,
           o.payment_ref is not null,
           (select coalesce(sum(i.quantity), 0) from sales.order_items i where i.order_id = o.id),
           o.eta_max_days, o.destination_department,
           o.updated_at, o.delivered_at
      from sales.orders o
      join commerce.stores s on s.id = o.store_id
     where o.courier_id = v_courier
       and (o.status in ('confirmado', 'preparando', 'listo', 'en_camino')
            or (o.status = 'entregado' and o.delivered_at >= v_today))
     order by case o.status when 'en_camino' then 0 when 'listo' then 1 when 'preparando' then 2 when 'confirmado' then 3 else 4 end,
              o.updated_at desc;
end $$;

-- Detalle de un pedido propio. Un pedido ajeno o inexistente responde igual («no encontrado»: no se revela cuál es).
-- `delivery_*` y las coordenadas del cliente salen solo si el pedido está `listo` o `en_camino`; si no, vienen nulos.
create or replace function public.courier_order(p_order uuid)
returns table (
  order_id uuid, number bigint, status text, delivery_class text,
  store_name text, store_address text, store_phone text, store_latitude numeric, store_longitude numeric,
  payment_method text, cash_total numeric, cash_registered boolean,
  items jsonb,
  eta_max_days smallint, destination_department text,
  client_first_name text, delivery_address text, delivery_phone text, delivery_notes text,
  dest_latitude numeric, dest_longitude numeric,
  updated_at timestamptz, delivered_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa ve sus pedidos' using errcode = '42501';
  end if;
  return query
    select o.id, o.number, o.status, o.delivery_class,
           o.store_name, s.address, s.contact_phone, s.latitude, s.longitude,
           o.payment_method,
           case when o.payment_method = 'efectivo' then o.total end,
           o.payment_ref is not null,
           coalesce((select jsonb_agg(jsonb_build_object('name', i.product_name, 'variant', i.variant_name, 'quantity', i.quantity) order by i.product_name, i.variant_name)
                       from sales.order_items i where i.order_id = o.id), '[]'::jsonb),
           o.eta_max_days, o.destination_department,
           case when open_ok then nullif(split_part(btrim(pii.full_name), ' ', 1), '') end,
           case when open_ok then d.address end,
           case when open_ok then d.phone end,
           case when open_ok then d.notes end,
           case when open_ok then d.latitude end,
           case when open_ok then d.longitude end,
           o.updated_at, o.delivered_at
      from sales.orders o
      join commerce.stores s on s.id = o.store_id
      left join sales.order_delivery d on d.order_id = o.id
      left join identity.profile_pii pii on pii.user_id = o.client_id
      cross join lateral (select o.status in ('listo', 'en_camino') as open_ok) f
     where o.id = p_order and o.courier_id = v_courier
       and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado');
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
end $$;

-- Entregas de los últimos días (máximo 31) con el efectivo que falta por rendir. No lleva datos del cliente.
create or replace function public.courier_history(p_days int default 7)
returns table (
  order_id uuid, number bigint, store_name text, delivery_class text, delivered_at timestamptz,
  distance_km numeric, payment_method text, cash_total numeric, cash_registered boolean, cash_received boolean
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v_days int := least(greatest(coalesce(p_days, 7), 1), 31);
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa ve sus entregas' using errcode = '42501';
  end if;
  return query
    select o.id, o.number, o.store_name, o.delivery_class, o.delivered_at,
           o.delivery_distance_km, o.payment_method,
           case when o.payment_method = 'efectivo' then o.total end,
           o.payment_ref is not null, o.cash_received_at is not null
      from sales.orders o
     where o.courier_id = v_courier and o.status = 'entregado'
       and o.delivered_at >= now() - make_interval(days => v_days)
     order by o.delivered_at desc
     limit 200;
end $$;

revoke all on function public.courier_orders(), public.courier_order(uuid), public.courier_history(int) from public, anon;
grant execute on function public.courier_orders(), public.courier_order(uuid), public.courier_history(int) to authenticated;
