-- Fase 3, etapa 1: motor de pedidos. Un pedido pertenece a una sola tienda, copia los precios al momento de la compra
-- y reserva el stock al crearse (con control de stock, la reserva descuenta de la cantidad y deja su movimiento).
-- Las tablas viven en `sales` (no expuesto); las apps leen vistas de `public` y escriben por funciones.
--
-- Estados: pendiente_pago -> por_confirmar -> confirmado -> preparando -> listo -> en_camino -> entregado,
--          y cancelado / rechazado (finales, liberan el stock).
-- Pago con tarjeta: nace en pendiente_pago (vence a los 30 minutos). Pago en efectivo: nace en por_confirmar.
-- Un pedido por confirmar vence a los 45 minutos si el comercio no responde.

create schema if not exists sales;
revoke all on schema sales from public, anon, authenticated;
grant usage on schema sales to authenticated;
alter default privileges for role postgres in schema sales revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema sales revoke all on sequences from anon, authenticated, service_role;

-- Costo de envío fijo por tienda (0 = sin costo). Lo fija el comercio o la administración.
alter table commerce.stores
  add column delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0 and delivery_fee < 100000);

create or replace view public.stores_list with (security_invoker = true) as
  select s.id, s.commerce_id, c.name as commerce_name, s.name, s.address, s.contact_phone, s.status,
         s.closed_until, s.closed_reason, s.created_at, s.updated_at,
         private.store_open_at(s) as open_now,
         (select count(*) from commerce.store_hours h where h.store_id = s.id) as hour_ranges,
         s.delivery_fee
  from commerce.stores s
  join identity.commerces c on c.id = s.commerce_id;

create or replace function public.set_store_delivery_fee(p_store uuid, p_fee numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old numeric;
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  if p_fee is null or p_fee < 0 or p_fee >= 100000 or p_fee <> round(p_fee, 2) then
    raise exception 'el costo de envío debe estar entre 0 y 99 999,99 con dos decimales' using errcode = '22023';
  end if;
  select delivery_fee into v_old from commerce.stores where id = p_store;
  update commerce.stores set delivery_fee = p_fee, updated_at = now() where id = p_store;
  perform private.write_audit('store.delivery_fee_changed', 'store', p_store::text,
    jsonb_build_object('delivery_fee', v_old), jsonb_build_object('delivery_fee', p_fee));
end $$;

-- Corrección: "hoy" para una excepción de horario es la fecha de Nicaragua, no la del servidor (UTC). Entre las 18:00 y las
-- 24:00 de Managua la fecha UTC ya es la de mañana y el comercio no podía cerrar la tienda por el resto de la noche.
create or replace function public.set_store_exception(
  p_store uuid, p_date date, p_closed boolean, p_opens time default null, p_closes time default null, p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  if p_date is null or p_date < (now() at time zone 'America/Managua')::date then
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

-- Tablas -----------------------------------------------------------------------------------------------------------

create table sales.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  client_id uuid not null references identity.profiles(id),
  store_id uuid not null references commerce.stores(id),
  commerce_id uuid not null references identity.commerces(id),
  store_name text not null,
  status text not null check (status in
    ('pendiente_pago', 'por_confirmar', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado', 'rechazado')),
  payment_method text not null check (payment_method in ('tarjeta', 'efectivo')),
  payment_status text not null default 'pendiente' check (payment_status in ('pendiente', 'pagado', 'fallido')),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  delivery_fee numeric(10, 2) not null check (delivery_fee >= 0),
  total numeric(12, 2) not null check (total >= 0),
  courier_id uuid references identity.couriers(id),
  status_reason text check (status_reason is null or char_length(status_reason) <= 200),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  delivered_at timestamptz
);
create index orders_client_idx on sales.orders (client_id, created_at desc);
create index orders_store_idx on sales.orders (store_id, created_at desc);
create index orders_commerce_idx on sales.orders (commerce_id, status);
create index orders_expiry_idx on sales.orders (expires_at) where status in ('pendiente_pago', 'por_confirmar');

create table sales.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sales.orders(id) on delete cascade,
  variant_id uuid not null references commerce.product_variants(id),
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  quantity int not null check (quantity between 1 and 99),
  line_total numeric(12, 2) not null check (line_total >= 0),
  -- true solo si al crear el pedido se descontó stock; así cancelar o vencer devuelve exactamente lo que se reservó,
  -- aunque el comercio active o desactive el control de stock después.
  stock_reserved boolean not null default false
);
create index order_items_order_idx on sales.order_items (order_id);

create table sales.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references sales.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  reason text,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on sales.order_events (order_id, id);

-- Datos de entrega (personales): viven aparte para que el comercio no los lea y para anonimizarlos al borrar la cuenta.
create table sales.order_delivery (
  order_id uuid primary key references sales.orders(id) on delete cascade,
  address text,
  phone text,
  notes text
);

alter table sales.orders enable row level security;
alter table sales.order_items enable row level security;
alter table sales.order_events enable row level security;
alter table sales.order_delivery enable row level security;

-- Coordinación y administración, siempre con sesión de consola.
create or replace function private.is_coordination_console()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_any_role(array['admin', 'superadmin', 'coordinador']::identity.app_role[])
     and private.has_strong_session();
$$;
grant execute on function private.is_coordination_console() to authenticated;

create policy orders_select_client on sales.orders
  for select to authenticated using (client_id = auth.uid() and private.has_valid_session());
create policy orders_select_commerce on sales.orders
  for select to authenticated using (private.has_role('comercio', commerce_id) and private.has_strong_session());
create policy orders_select_coordination on sales.orders
  for select to authenticated using (private.is_coordination_console());

create policy order_items_select on sales.order_items
  for select to authenticated using (exists (select 1 from sales.orders o where o.id = order_items.order_id));
create policy order_events_select on sales.order_events
  for select to authenticated using (exists (select 1 from sales.orders o where o.id = order_events.order_id));

create policy order_delivery_select_client on sales.order_delivery
  for select to authenticated using (exists (
    select 1 from sales.orders o where o.id = order_delivery.order_id and o.client_id = auth.uid() and private.has_valid_session()));
create policy order_delivery_select_coordination on sales.order_delivery
  for select to authenticated using (private.is_coordination_console());

grant select on sales.orders, sales.order_items, sales.order_events, sales.order_delivery to authenticated;

-- Stock ------------------------------------------------------------------------------------------------------------

-- Devuelve al inventario lo que el pedido había reservado (solo variantes con control de stock).
create or replace function private.release_order_stock(p_order uuid, p_label text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_after int;
begin
  for r in
    select oi.variant_id, sum(oi.quantity)::int as qty
    from sales.order_items oi
    where oi.order_id = p_order and oi.stock_reserved
    group by oi.variant_id
    order by oi.variant_id
  loop
    update commerce.inventory set quantity = quantity + r.qty, updated_at = now()
     where variant_id = r.variant_id and track_stock
     returning quantity into v_after;
    if found then
      insert into commerce.stock_movements (variant_id, store_id, kind, delta, quantity_after, reason, created_by)
      select r.variant_id, i.store_id, 'entrada', r.qty, v_after, left(p_label, 200), auth.uid()
      from commerce.inventory i where i.variant_id = r.variant_id;
    end if;
  end loop;
end $$;

-- Crear el pedido ----------------------------------------------------------------------------------------------------

-- p_items: [{"variant_id": "...", "quantity": 2}, ...]. Solo clientes con sesión vigente.
create or replace function public.create_order(
  p_store uuid, p_items jsonb, p_payment_method text, p_address text, p_phone text, p_notes text default null
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
  if (select count(*) from sales.orders
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

-- Cambiar de estado -------------------------------------------------------------------------------------------------

-- Quién puede mover cada estado:
--   cliente (dueño): cancelar mientras está pendiente_pago o por_confirmar.
--   comercio (de la tienda): confirmar o rechazar; confirmado -> preparando -> listo; cancelar confirmado o preparando.
--   coordinación y administración: todo lo anterior como excepción, listo -> en_camino -> entregado y cancelar cualquier pedido abierto.
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
  if p_to is null or p_to not in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado', 'rechazado') then
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
    v_allowed := (v_client and v_order.status in ('pendiente_pago', 'por_confirmar'))
              or (v_shop and v_order.status in ('por_confirmar', 'confirmado', 'preparando'))
              or v_coord;
  elsif p_to = 'rechazado' then
    v_allowed := (v_shop or v_coord) and v_order.status = 'por_confirmar';
  elsif p_to = 'confirmado' then
    v_allowed := (v_shop or v_coord) and v_order.status = 'por_confirmar';
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
    expires_at = null,
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
  if not exists (select 1 from identity.couriers where id = p_courier and status = 'activo') then
    raise exception 'repartidor no disponible' using errcode = 'P0002';
  end if;
  update sales.orders set courier_id = p_courier, updated_at = now() where id = p_order;
  perform private.write_audit('order.courier_assigned', 'order', p_order::text, null,
    jsonb_build_object('courier_id', p_courier));
end $$;

-- Cobro con tarjeta: la llamará la función de borde del webhook (etapa 3) con la clave de servicio.
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
         expires_at = now() + interval '45 minutes', updated_at = now()
   where id = p_order;
  insert into sales.order_events (order_id, from_status, to_status, reason)
  values (p_order, 'pendiente_pago', 'por_confirmar', 'pago recibido');
  perform private.write_audit('order.paid', 'order', p_order::text);
end $$;

-- Vencimiento: libera el stock de los pedidos que nadie pagó o confirmó a tiempo.
create or replace function private.expire_stale_orders()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r sales.orders;
  v_count int := 0;
begin
  for r in
    select * from sales.orders
     where status in ('pendiente_pago', 'por_confirmar') and expires_at is not null and expires_at <= now()
     order by expires_at
     for update skip locked
  loop
    update sales.orders set status = 'cancelado', status_reason = 'vencido sin respuesta', expires_at = null,
           updated_at = now() where id = r.id;
    perform private.release_order_stock(r.id, 'Pedido ' || r.number || ' vencido');
    insert into sales.order_events (order_id, from_status, to_status, reason)
    values (r.id, r.status, 'cancelado', 'vencido sin respuesta');
    perform private.write_audit('order.expired', 'order', r.id::text, jsonb_build_object('status', r.status));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

select cron.schedule('expire-stale-orders', '*/5 * * * *', $$select private.expire_stale_orders()$$);

-- Al anonimizar una cuenta se borran los datos de entrega de sus pedidos (el pedido y sus montos se conservan).
create or replace function private.wipe_order_delivery()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from sales.order_delivery d using sales.orders o where o.id = d.order_id and o.client_id = new.id;
  return new;
end $$;

create trigger wipe_order_delivery_on_anonymize
  after update of status on identity.profiles
  for each row when (new.status = 'anonimizada' and old.status is distinct from new.status)
  execute function private.wipe_order_delivery();

-- Vistas ------------------------------------------------------------------------------------------------------------

create view public.orders_list with (security_invoker = true) as
  select o.id, o.number, o.client_id, o.store_id, o.store_name, o.commerce_id, o.status, o.payment_method,
         o.payment_status, o.subtotal, o.delivery_fee, o.total, o.courier_id, o.status_reason, o.expires_at,
         o.created_at, o.updated_at, o.confirmed_at, o.delivered_at,
         (select coalesce(sum(i.quantity), 0) from sales.order_items i where i.order_id = o.id) as item_count
  from sales.orders o;

create view public.order_items_list with (security_invoker = true) as
  select id, order_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total
  from sales.order_items;

create view public.order_events_list with (security_invoker = true) as
  select id, order_id, from_status, to_status, reason, created_at from sales.order_events;

create view public.order_delivery_list with (security_invoker = true) as
  select order_id, address, phone, notes from sales.order_delivery;

-- Permisos ----------------------------------------------------------------------------------------------------------

revoke all on function public.set_store_delivery_fee(uuid, numeric),
  public.create_order(uuid, jsonb, text, text, text, text),
  public.set_order_status(uuid, text, text),
  public.assign_order_courier(uuid, uuid),
  public.mark_order_paid(uuid)
from public, anon, authenticated;
grant execute on function public.set_store_delivery_fee(uuid, numeric),
  public.create_order(uuid, jsonb, text, text, text, text),
  public.set_order_status(uuid, text, text),
  public.assign_order_courier(uuid, uuid)
to authenticated;
grant execute on function public.mark_order_paid(uuid) to service_role;

revoke all on public.orders_list, public.order_items_list, public.order_events_list, public.order_delivery_list
  from public, anon;
grant select on public.orders_list, public.order_items_list, public.order_events_list, public.order_delivery_list
  to authenticated;
