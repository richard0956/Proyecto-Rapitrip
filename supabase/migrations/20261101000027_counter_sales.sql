-- Fase 3, etapa 4: caja y venta de mostrador.
--
-- El cajero abre un turno de caja con un monto inicial, registra ventas de mostrador (efectivo o tarjeta en un terminal
-- externo) y cierra el turno contando el efectivo: la diferencia con lo esperado queda registrada.
-- Una venta de mostrador es un pedido más (`channel = 'mostrador'`): sin cliente ni envío, ya pagada y entregada, que
-- descuenta el stock al instante. Se puede anular dentro del turno abierto y devuelve el stock.
-- Supuesto: el cajero puede vender productos de cualquier tienda activa; si cada caja debe atar a una tienda, se ajusta aquí.

-- Pedidos sin cliente -----------------------------------------------------------------------------------------------

alter table sales.orders alter column client_id drop not null;
alter table sales.orders
  add column channel text not null default 'web' check (channel in ('web', 'mostrador')),
  add column cashier_id uuid references identity.profiles(id),
  add column cash_session_id uuid,
  add constraint orders_client_by_channel check ((channel = 'web') = (client_id is not null)),
  add constraint orders_cashier_by_channel check ((channel = 'mostrador') = (cashier_id is not null));

-- Una venta de mostrador pagada con tarjeta en el terminal externo no pasa por Stripe: anularla no genera reembolso en cola.
create or replace function private.queue_refund_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.channel = 'web' and new.status in ('cancelado', 'rechazado') and old.status not in ('cancelado', 'rechazado')
     and new.payment_method = 'tarjeta' and new.payment_status = 'pagado' then
    new.payment_status := 'reembolso_pendiente';
    perform private.write_audit('order.refund_queued', 'order', new.id::text, null,
      jsonb_build_object('number', new.number, 'status', new.status));
  end if;
  return new;
end $$;

-- Turnos de caja ----------------------------------------------------------------------------------------------------

create table sales.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references identity.profiles(id),
  opened_at timestamptz not null default now(),
  opening_amount numeric(12, 2) not null check (opening_amount >= 0 and opening_amount < 100000000),
  closed_at timestamptz,
  expected_amount numeric(12, 2),
  counted_amount numeric(12, 2) check (counted_amount is null or (counted_amount >= 0 and counted_amount < 100000000)),
  difference numeric(12, 2),
  note text check (note is null or char_length(note) <= 200)
);
-- Un cajero solo puede tener un turno abierto a la vez.
create unique index cash_sessions_one_open on sales.cash_sessions (cashier_id) where closed_at is null;
create index cash_sessions_cashier_idx on sales.cash_sessions (cashier_id, opened_at desc);

alter table sales.orders add constraint orders_cash_session_fk foreign key (cash_session_id) references sales.cash_sessions(id);
create index orders_cash_session_idx on sales.orders (cash_session_id) where cash_session_id is not null;

alter table sales.cash_sessions enable row level security;

create or replace function private.is_cashier()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('cajero') and private.has_strong_session();
$$;
grant execute on function private.is_cashier() to authenticated;

create or replace function private.require_cashier()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_cashier() then
    raise exception 'solo el equipo de caja puede hacer esto, con sesión de consola' using errcode = '42501';
  end if;
end $$;

create policy cash_sessions_select_cashier on sales.cash_sessions
  for select to authenticated using (cashier_id = auth.uid() and private.is_cashier());
create policy cash_sessions_select_admin on sales.cash_sessions
  for select to authenticated using (private.is_admin_console());
grant select on sales.cash_sessions to authenticated;

-- El cajero ve sus propias ventas de mostrador (los renglones y el historial siguen a la visibilidad del pedido).
create policy orders_select_cashier on sales.orders
  for select to authenticated using (channel = 'mostrador' and cashier_id = auth.uid() and private.is_cashier());

-- Catálogo de mostrador ---------------------------------------------------------------------------------------------

-- Lo vendible hoy: productos publicados, variantes activas, tiendas y comercios activos. Con control de stock, solo con existencias.
create or replace function public.counter_catalog()
returns table (store_id uuid, store_name text, variant_id uuid, product_name text, variant_name text, sku text, price numeric, quantity int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_cashier();
  return query
    select s.id, s.name, v.id, p.name, v.name, v.sku, v.price, case when i.track_stock then i.quantity else null end
      from commerce.product_variants v
      join commerce.products p on p.id = v.product_id and p.status = 'publicado'
      join commerce.stores s on s.id = v.store_id and s.status = 'activa'
      join identity.commerces c on c.id = s.commerce_id and c.status = 'activo'
      left join commerce.inventory i on i.variant_id = v.id
     where v.status = 'activa' and (i.variant_id is null or not i.track_stock or i.quantity > 0)
     order by s.name, p.name, v.name;
end $$;

-- Turno -------------------------------------------------------------------------------------------------------------

create or replace function public.open_cash_session(p_opening numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_cashier();
  if p_opening is null or p_opening < 0 or p_opening >= 100000000 or p_opening <> round(p_opening, 2) then
    raise exception 'el monto inicial debe ser 0 o más, con dos decimales' using errcode = '22023';
  end if;
  begin
    insert into sales.cash_sessions (cashier_id, opening_amount) values (auth.uid(), p_opening) returning id into v_id;
  exception when unique_violation then
    raise exception 'ya tienes un turno de caja abierto' using errcode = '23505';
  end;
  perform private.write_audit('cash_session.opened', 'cash_session', v_id::text, null, jsonb_build_object('opening', p_opening));
  return v_id;
end $$;

-- Efectivo esperado: monto inicial más las ventas de mostrador en efectivo que no se anularon.
create or replace function private.expected_cash(p_session uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select s.opening_amount + coalesce((
    select sum(o.total) from sales.orders o
     where o.cash_session_id = s.id and o.channel = 'mostrador' and o.payment_method = 'efectivo' and o.status <> 'cancelado'), 0)
  from sales.cash_sessions s where s.id = p_session;
$$;

create or replace function public.close_cash_session(p_counted numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session sales.cash_sessions;
  v_expected numeric(12, 2);
  v_diff numeric(12, 2);
  v_note text := nullif(btrim(p_note), '');
begin
  perform private.require_cashier();
  select * into v_session from sales.cash_sessions where cashier_id = auth.uid() and closed_at is null for update;
  if not found then
    raise exception 'no tienes un turno de caja abierto' using errcode = 'P0002';
  end if;
  if p_counted is null or p_counted < 0 or p_counted >= 100000000 or p_counted <> round(p_counted, 2) then
    raise exception 'el efectivo contado debe ser 0 o más, con dos decimales' using errcode = '22023';
  end if;
  v_expected := private.expected_cash(v_session.id);
  v_diff := p_counted - v_expected;
  if v_diff <> 0 and (v_note is null or char_length(v_note) < 5) then
    raise exception 'hay una diferencia de caja: explica el motivo (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  update sales.cash_sessions
     set closed_at = now(), expected_amount = v_expected, counted_amount = p_counted, difference = v_diff, note = v_note
   where id = v_session.id;
  perform private.write_audit('cash_session.closed', 'cash_session', v_session.id::text, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', v_diff), v_note);
  return jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', v_diff);
end $$;

-- Ventas ------------------------------------------------------------------------------------------------------------

-- p_items: [{"variant_id": "...", "quantity": 2}, ...]. Un solo comercio y una sola tienda por venta.
create or replace function public.create_counter_sale(p_store uuid, p_items jsonb, p_payment_method text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_session sales.cash_sessions;
  v_store commerce.stores;
  v_order sales.orders;
  v_item record;
  v_var record;
  v_inv commerce.inventory;
  v_reserved boolean;
  v_subtotal numeric(12, 2) := 0;
  v_label text;
begin
  perform private.require_cashier();
  if p_payment_method is null or p_payment_method not in ('efectivo', 'tarjeta') then
    raise exception 'elige un método de pago válido' using errcode = '22023';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'la venta debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;
  select * into v_session from sales.cash_sessions where cashier_id = auth.uid() and closed_at is null;
  if not found then
    raise exception 'abre un turno de caja antes de vender' using errcode = '22023';
  end if;
  select * into v_store from commerce.stores where id = p_store and status = 'activa';
  if not found or not exists (select 1 from identity.commerces where id = v_store.commerce_id and status = 'activo') then
    raise exception 'tienda no disponible' using errcode = 'P0002';
  end if;

  insert into sales.orders (channel, cashier_id, cash_session_id, store_id, commerce_id, store_name, status, payment_method, payment_status,
                            subtotal, delivery_fee, total, confirmed_at, delivered_at)
  values ('mostrador', auth.uid(), v_session.id, p_store, v_store.commerce_id, v_store.name, 'entregado', p_payment_method, 'pagado',
          0, 0, 0, now(), now())
  returning * into v_order;
  v_label := 'Venta de mostrador ' || v_order.number;

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
      raise exception 'un producto de la venta no está disponible' using errcode = '22023';
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

  update sales.orders set subtotal = v_subtotal, total = v_subtotal where id = v_order.id;
  insert into sales.order_events (order_id, from_status, to_status, reason, actor_id) values (v_order.id, null, 'entregado', 'venta de mostrador', auth.uid());
  perform private.write_audit('counter_sale.created', 'order', v_order.id::text, null,
    jsonb_build_object('number', v_order.number, 'store_id', p_store, 'total', v_subtotal, 'payment_method', p_payment_method));
  return v_order.id;
end $$;

-- Anular una venta de mostrador: solo la del propio cajero y dentro de su turno abierto. Devuelve el stock.
create or replace function public.void_counter_sale(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform private.require_cashier();
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 200 then
    raise exception 'indica el motivo (entre 5 y 200 caracteres)' using errcode = '22023';
  end if;
  select * into v_order from sales.orders where id = p_order and channel = 'mostrador' and cashier_id = auth.uid() for update;
  if not found then
    raise exception 'venta no encontrada' using errcode = 'P0002';
  end if;
  if v_order.status <> 'entregado' then
    raise exception 'la venta ya está anulada' using errcode = '22023';
  end if;
  if not exists (select 1 from sales.cash_sessions where id = v_order.cash_session_id and closed_at is null) then
    raise exception 'el turno de esta venta ya se cerró: pide a administración que la corrija' using errcode = '22023';
  end if;
  update sales.orders set status = 'cancelado', status_reason = v_reason, updated_at = now() where id = p_order;
  perform private.release_order_stock(p_order, 'Venta de mostrador ' || v_order.number || ' anulada');
  insert into sales.order_events (order_id, from_status, to_status, reason, actor_id) values (p_order, 'entregado', 'cancelado', v_reason, auth.uid());
  perform private.write_audit('counter_sale.voided', 'order', p_order::text, null, jsonb_build_object('number', v_order.number), v_reason);
end $$;

-- Vistas ------------------------------------------------------------------------------------------------------------

create or replace view public.orders_list with (security_invoker = true) as
  select o.id, o.number, o.client_id, o.store_id, o.store_name, o.commerce_id, o.status, o.payment_method,
         o.payment_status, o.subtotal, o.delivery_fee, o.total, o.courier_id, o.status_reason, o.expires_at,
         o.created_at, o.updated_at, o.confirmed_at, o.delivered_at,
         (select coalesce(sum(i.quantity), 0) from sales.order_items i where i.order_id = o.id) as item_count,
         o.channel, o.cashier_id, o.cash_session_id
  from sales.orders o;

create view public.cash_sessions_list with (security_invoker = true) as
  select s.id, s.cashier_id, s.opened_at, s.opening_amount, s.closed_at, s.expected_amount, s.counted_amount, s.difference, s.note,
         (select count(*) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado') as sales_count,
         (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado') as sales_total,
         (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado' and o.payment_method = 'efectivo') as cash_total,
         coalesce(s.expected_amount, s.opening_amount + (select coalesce(sum(o.total), 0) from sales.orders o
                                                           where o.cash_session_id = s.id and o.status <> 'cancelado' and o.payment_method = 'efectivo')) as cash_expected
  from sales.cash_sessions s;

revoke all on function public.counter_catalog(), public.open_cash_session(numeric), public.close_cash_session(numeric, text),
  public.create_counter_sale(uuid, jsonb, text), public.void_counter_sale(uuid, text)
from public, anon;
grant execute on function public.counter_catalog(), public.open_cash_session(numeric), public.close_cash_session(numeric, text),
  public.create_counter_sale(uuid, jsonb, text), public.void_counter_sale(uuid, text)
to authenticated;

revoke all on public.cash_sessions_list from public, anon;
grant select on public.cash_sessions_list to authenticated;
