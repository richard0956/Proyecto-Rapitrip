-- Entregas express y programadas, etapa 1 (parte 3): una compra con varias tiendas se divide en varios pedidos.
-- Diseño: docs/informe/2026-10-21-entregas-express-programado-design.md.
--
-- `sales.checkouts` agrupa los pedidos de una misma compra (uno por tienda y clase de entrega). `create_checkout` los crea
-- todos en una transacción: si cualquier tienda falla (cerrada, sin stock, fuera de cobertura...) no se crea nada y el
-- error dice cuál tienda fue. Cada pedido conserva su envío, su repartidor, su estado y sus devoluciones.
-- `create_order` (una tienda, solo express) sigue funcionando; ahora rechaza productos que no pueden ir en moto.

create table sales.checkouts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references identity.profiles(id),
  client_ref uuid,
  payment_method text not null check (payment_method in ('tarjeta', 'efectivo')),
  total numeric(12, 2) not null default 0 check (total >= 0),
  order_count smallint not null default 0 check (order_count >= 0),
  created_at timestamptz not null default now()
);
create unique index checkouts_client_ref_unique on sales.checkouts (client_id, client_ref) where client_ref is not null;
create index checkouts_client_idx on sales.checkouts (client_id, created_at desc);

alter table sales.checkouts enable row level security;
create policy checkouts_select_client on sales.checkouts
  for select to authenticated using (client_id = auth.uid() and private.has_valid_session());
create policy checkouts_select_coordination on sales.checkouts
  for select to authenticated using (private.is_coordination_console());
grant select on sales.checkouts to authenticated;

create view public.my_checkouts with (security_invoker = true) as
  select id, payment_method, total, order_count, created_at from sales.checkouts where client_id = auth.uid();
revoke all on public.my_checkouts from public, anon;
grant select on public.my_checkouts to authenticated;

-- Datos de entrega por clase en cada pedido. Los pedidos anteriores son express (así se entregaban).
alter table sales.orders
  add column checkout_id uuid references sales.checkouts(id),
  add column delivery_class text not null default 'express' check (delivery_class in ('express', 'programado')),
  add column class_reason text check (class_reason in ('producto', 'distancia', 'otro_departamento')),
  add column origin_department text references sales.departments(code),
  add column destination_department text references sales.departments(code),
  add column delivery_band smallint,
  add column eta_min_days smallint,
  add column eta_max_days smallint;
create index orders_checkout_idx on sales.orders (checkout_id) where checkout_id is not null;

create or replace view public.orders_list with (security_invoker = true) as
  select o.id, o.number, o.client_id, o.store_id, o.store_name, o.commerce_id, o.status, o.payment_method,
         o.payment_status, o.subtotal, o.delivery_fee, o.total, o.courier_id, o.status_reason, o.expires_at,
         o.created_at, o.updated_at, o.confirmed_at, o.delivered_at,
         (select coalesce(sum(i.quantity), 0) from sales.order_items i where i.order_id = o.id) as item_count,
         o.channel, o.cashier_id, o.cash_session_id,
         o.payment_ref, o.cash_received_at,
         o.checkout_id, o.delivery_class, o.class_reason, o.origin_department, o.destination_department,
         o.eta_min_days, o.eta_max_days
  from sales.orders o;

-- `create_order` (una tienda): igual que antes, pero un producto que no puede ir en moto solo se compra con `create_checkout`.
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

  if p_items is not null and jsonb_typeof(p_items) = 'array' and exists (
       select 1 from jsonb_array_elements(p_items) e
       join commerce.product_variants v on v.id = (e ->> 'variant_id')::uuid
       where not private.product_express_ok(v.product_id)) then
    raise exception 'un producto del pedido solo se entrega de forma programada' using errcode = '22023';
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

-- Resultado de una compra: los pedidos que la forman.
create or replace function private.checkout_result(p_checkout uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'checkout_id', c.id,
    'total', c.total,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id', o.id, 'number', o.number, 'store_id', o.store_id, 'store_name', o.store_name,
        'delivery_class', o.delivery_class, 'class_reason', o.class_reason, 'total', o.total, 'delivery_fee', o.delivery_fee,
        'eta_min_days', o.eta_min_days, 'eta_max_days', o.eta_max_days) order by o.number)
      from sales.orders o where o.checkout_id = c.id), '[]'::jsonb))
  from sales.checkouts c where c.id = p_checkout;
$$;

-- Crea una compra con varias tiendas.
-- p_groups: [{"store_id": "...", "items": [{"variant_id": "...", "quantity": 2}], "quote_id": "..."(opcional)}, ...]
-- Hasta 4 tiendas, cada una una sola vez. Todo o nada.
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
               eta_max_days = (v_ship ->> 'eta_max_days')::smallint
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

  update sales.checkouts set total = v_total, order_count = v_count where id = v_checkout;
  perform private.write_audit('checkout.created', 'checkout', v_checkout::text, null,
    jsonb_build_object('orders', v_count, 'total', v_total));
  return private.checkout_result(v_checkout);
end $$;

revoke all on function private.checkout_result(uuid) from public, anon, authenticated;
revoke all on function public.create_checkout(jsonb, text, text, text, text, uuid, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.create_checkout(jsonb, text, text, text, text, uuid, numeric, numeric, text) to authenticated;
