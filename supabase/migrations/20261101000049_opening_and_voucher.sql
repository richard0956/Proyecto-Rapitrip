-- Arqueo y cierre de caja, etapa 4.
-- 1) Apertura: el saldo inicial es el efectivo contado en el último cierre del mismo cajero. No se escribe a mano.
--    El primer turno de un cajero sí pide el monto inicial.
-- 2) Ventas de mostrador: la tarjeta exige el voucher del terminal (4 a 20 caracteres); el efectivo recibe un código CE-XXXXXX.
--    El voucher es único por tienda mientras la venta no esté cancelada (índice de la etapa 1).

create or replace function public.open_cash_session(p_opening numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_prev sales.cash_sessions;
  v_opening numeric(12, 2);
begin
  perform private.require_cashier();
  select * into v_prev from sales.cash_sessions
   where cashier_id = auth.uid() and closed_at is not null
   order by closed_at desc limit 1;
  if found then
    v_opening := v_prev.counted_amount;
    if p_opening is not null and p_opening <> v_opening then
      raise exception 'el saldo inicial es el efectivo del cierre anterior: %', v_opening using errcode = '22023';
    end if;
  else
    if p_opening is null then
      raise exception 'el primer turno necesita el monto inicial' using errcode = '22023';
    end if;
    v_opening := p_opening;
  end if;
  if v_opening < 0 or v_opening >= 100000000 or v_opening <> round(v_opening, 2) then
    raise exception 'el monto inicial debe ser 0 o más, con dos decimales' using errcode = '22023';
  end if;
  begin
    insert into sales.cash_sessions (cashier_id, opening_amount) values (auth.uid(), v_opening) returning id into v_id;
  exception when unique_violation then
    raise exception 'ya tienes un turno de caja abierto' using errcode = '23505';
  end;
  update sales.orders set cash_session_id = v_id, updated_at = now()
   where channel = 'web' and payment_method = 'tarjeta' and payment_status = 'pagado'
     and cash_session_id is null and status <> 'cancelado';
  perform private.write_audit('cash_session.opened', 'cash_session', v_id::text, null, jsonb_build_object('opening', v_opening));
  return v_id;
end $$;

drop function public.create_counter_sale(uuid, jsonb, text);

-- p_items: [{"variant_id": "...", "quantity": 2}, ...]. Un solo comercio y una sola tienda por venta.
-- p_reference: voucher del terminal (tarjeta, obligatorio) o nada (efectivo: el sistema genera el código).
create or replace function public.create_counter_sale(p_store uuid, p_items jsonb, p_payment_method text, p_reference text default null)
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
  v_ref text;
begin
  perform private.require_cashier();
  if p_payment_method is null or p_payment_method not in ('efectivo', 'tarjeta') then
    raise exception 'elige un método de pago válido' using errcode = '22023';
  end if;
  if p_payment_method = 'tarjeta' then
    v_ref := nullif(btrim(p_reference), '');
    if v_ref is null or char_length(v_ref) not between 4 and 20 then
      raise exception 'el voucher de la tarjeta debe tener entre 4 y 20 caracteres' using errcode = '22023';
    end if;
  else
    v_ref := 'CE-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
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

  begin
    insert into sales.orders (channel, cashier_id, cash_session_id, store_id, commerce_id, store_name, status, payment_method, payment_status,
                              subtotal, delivery_fee, total, confirmed_at, delivered_at, payment_ref)
    values ('mostrador', auth.uid(), v_session.id, p_store, v_store.commerce_id, v_store.name, 'entregado', p_payment_method, 'pagado',
            0, 0, 0, now(), now(), v_ref)
    returning * into v_order;
  exception when unique_violation then
    raise exception 'ese voucher ya está registrado en esta tienda' using errcode = '23505';
  end;
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
    jsonb_build_object('number', v_order.number, 'store_id', p_store, 'total', v_subtotal, 'payment_method', p_payment_method, 'reference', v_ref));
  return v_order.id;
end $$;

revoke all on function public.create_counter_sale(uuid, jsonb, text, text) from public, anon;
grant execute on function public.create_counter_sale(uuid, jsonb, text, text) to authenticated;

-- El cierre usa la hora real (clock_timestamp) para que el "último cierre" sea exacto aunque varios cierres ocurran en una misma transacción.
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
     set closed_at = clock_timestamp(), expected_amount = v_expected, counted_amount = p_counted, difference = v_diff, note = v_note
   where id = v_session.id;
  perform private.write_audit('cash_session.closed', 'cash_session', v_session.id::text, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', v_diff), v_note);
  return jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', v_diff);
end $$;

revoke all on function public.close_cash_session(numeric, text) from public, anon;
grant execute on function public.close_cash_session(numeric, text) to authenticated;
