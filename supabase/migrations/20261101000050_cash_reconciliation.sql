-- Arqueo y cierre de caja, etapa 5.
-- El efectivo esperado suma el monto inicial, el efectivo de mostrador y el efectivo de pedidos web que el cajero recibió en el turno.
-- Al cerrar se guardan las incidencias (una fila por diferencia). Si hay incidencias, la nota es obligatoria. No se bloquea el cierre.

-- Efectivo esperado: monto inicial + efectivo de mostrador no anulado + efectivo web recibido por el cajero en el turno.
create or replace function private.expected_cash(p_session uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select s.opening_amount
       + coalesce((select sum(o.total) from sales.orders o
                    where o.cash_session_id = s.id and o.channel = 'mostrador' and o.payment_method = 'efectivo' and o.status <> 'cancelado'), 0)
       + coalesce((select sum(o.total) from sales.orders o
                    where o.cash_received_session = s.id and o.status <> 'cancelado'), 0)
  from sales.cash_sessions s where s.id = p_session;
$$;

-- Totales del turno por medio de pago.
create or replace function private.cash_breakdown(p_session uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'efectivo_mostrador', coalesce(sum(o.total) filter (where o.channel = 'mostrador' and o.payment_method = 'efectivo' and o.cash_session_id = p_session), 0),
    'efectivo_web_recibido', coalesce(sum(o.total) filter (where o.cash_received_session = p_session), 0),
    'tarjeta_mostrador', coalesce(sum(o.total) filter (where o.channel = 'mostrador' and o.payment_method = 'tarjeta' and o.cash_session_id = p_session), 0),
    'tarjeta_web', coalesce(sum(o.total) filter (where o.channel = 'web' and o.payment_method = 'tarjeta' and o.payment_status = 'pagado' and o.cash_session_id = p_session), 0))
  from sales.orders o
  where o.status <> 'cancelado' and (o.cash_session_id = p_session or o.cash_received_session = p_session);
$$;

-- Incidencias de inventario y de pagos del turno. El cruce de stock es por texto del motivo: "Pedido N" o "Venta de mostrador N".
create or replace function private.record_cash_incidents(p_session uuid, p_end timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_session sales.cash_sessions;
  v_count integer;
begin
  select * into v_session from sales.cash_sessions where id = p_session;

  -- Pago web con tarjeta asignado al turno sin pago confirmado
  insert into sales.cash_session_incidents (session_id, order_id, commerce_id, kind, detail)
  select p_session, o.id, o.commerce_id, 'pago_no_confirmado', 'Pedido ' || o.number || ' sin pago confirmado'
    from sales.orders o
   where o.cash_session_id = p_session and o.channel = 'web' and o.payment_method = 'tarjeta'
     and o.payment_status <> 'pagado' and o.status <> 'cancelado';

  -- Venta de tarjeta de mostrador sin voucher
  insert into sales.cash_session_incidents (session_id, order_id, commerce_id, kind, detail)
  select p_session, o.id, o.commerce_id, 'voucher_faltante', 'Venta de mostrador ' || o.number || ' sin voucher'
    from sales.orders o
   where o.cash_session_id = p_session and o.channel = 'mostrador' and o.payment_method = 'tarjeta'
     and o.payment_ref is null and o.status <> 'cancelado';

  -- Efectivo que el repartidor registró al entregar y el cajero no recibió (entregado dentro de la ventana del turno)
  insert into sales.cash_session_incidents (session_id, order_id, commerce_id, kind, detail)
  select p_session, o.id, o.commerce_id, 'efectivo_no_recibido',
         'Pedido ' || o.number || ': efectivo ' || o.payment_ref || ' registrado por el repartidor y no recibido en caja'
    from sales.orders o
   where o.channel = 'web' and o.payment_method = 'efectivo' and o.payment_ref is not null
     and o.cash_received_at is null and o.status = 'entregado'
     and o.delivered_at >= v_session.opened_at and o.delivered_at <= p_end;

  -- Renglón con stock descontado sin su movimiento de salida
  insert into sales.cash_session_incidents (session_id, order_id, commerce_id, kind, detail)
  select p_session, o.id, o.commerce_id, 'sin_movimiento_stock',
         'Pedido ' || o.number || ': ' || oi.product_name || ' sin movimiento de stock'
    from sales.order_items oi
    join sales.orders o on o.id = oi.order_id
   where o.cash_session_id = p_session and oi.stock_reserved
     and not exists (
       select 1 from commerce.stock_movements m
        where m.variant_id = oi.variant_id and m.kind = 'salida'
          and (m.reason = 'Pedido ' || o.number::text or m.reason like 'Pedido ' || o.number::text || ' %'
               or m.reason = 'Venta de mostrador ' || o.number::text));

  -- Salida de stock dentro de la ventana del turno que no corresponde a ninguna venta
  insert into sales.cash_session_incidents (session_id, order_id, commerce_id, kind, detail)
  select p_session, null, s.commerce_id, 'movimiento_sin_venta', 'Salida de stock sin venta: ' || m.reason
    from commerce.stock_movements m
    join commerce.stores s on s.id = m.store_id
   where m.kind = 'salida' and m.created_at >= v_session.opened_at and m.created_at <= p_end
     and not exists (
       select 1 from sales.orders o
        where m.reason = 'Pedido ' || o.number::text or m.reason like 'Pedido ' || o.number::text || ' %'
           or m.reason = 'Venta de mostrador ' || o.number::text);

  -- Stock guardado distinto del calculado: stock al abrir el turno + movimientos de la ventana
  insert into sales.cash_session_incidents (session_id, order_id, commerce_id, kind, detail)
  select p_session, null, s.commerce_id, 'descuadre_stock',
         'Stock guardado ' || i.quantity || ' y calculado ' || (ref.qty + mov.delta_sum) || ' en una variante'
    from commerce.inventory i
    join commerce.stores s on s.id = i.store_id
    cross join lateral (
      select m.quantity_after as qty from commerce.stock_movements m
       where m.variant_id = i.variant_id and m.created_at < v_session.opened_at
       order by m.created_at desc, m.id desc limit 1) ref
    cross join lateral (
      select coalesce(sum(m.delta), 0) as delta_sum from commerce.stock_movements m
       where m.variant_id = i.variant_id and m.created_at >= v_session.opened_at and m.created_at <= p_end) mov
   where i.track_stock and ref.qty + mov.delta_sum <> i.quantity;

  select count(*) into v_count from sales.cash_session_incidents where session_id = p_session;
  return v_count;
end $$;

create or replace function public.close_cash_session(p_counted numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session sales.cash_sessions;
  v_expected numeric(12, 2);
  v_diff numeric(12, 2);
  v_note text := nullif(btrim(p_note), '');
  v_end timestamptz := clock_timestamp();
  v_incidents integer;
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

  update sales.cash_sessions
     set closed_at = v_end, expected_amount = v_expected, counted_amount = p_counted, difference = v_diff, note = v_note
   where id = v_session.id;

  if v_diff <> 0 then
    insert into sales.cash_session_incidents (session_id, kind, detail)
    values (v_session.id, 'diferencia_efectivo', 'Diferencia de efectivo: ' || v_diff);
  end if;
  v_incidents := private.record_cash_incidents(v_session.id, v_end);

  if v_incidents > 0 and (v_note is null or char_length(v_note) < 5) then
    raise exception 'hay incidencias de caja: explica el motivo (mínimo 5 caracteres)' using errcode = '22023';
  end if;

  perform private.write_audit('cash_session.closed', 'cash_session', v_session.id::text, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', v_diff, 'incidents', v_incidents), v_note);
  return jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', v_diff,
                            'incidents_count', v_incidents, 'por_medio', private.cash_breakdown(v_session.id));
end $$;

revoke all on function public.close_cash_session(numeric, text) from public, anon;
grant execute on function public.close_cash_session(numeric, text) to authenticated;

-- El listado de turnos usa el mismo efectivo esperado que el cierre.
create or replace view public.cash_sessions_list with (security_invoker = true) as
  select s.id, s.cashier_id, s.opened_at, s.opening_amount, s.closed_at, s.expected_amount, s.counted_amount, s.difference, s.note,
         (select count(*) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado') as sales_count,
         (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado') as sales_total,
         (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado' and o.payment_method = 'efectivo') as cash_total,
         coalesce(s.expected_amount, s.opening_amount
           + (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.channel = 'mostrador' and o.payment_method = 'efectivo' and o.status <> 'cancelado')
           + (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_received_session = s.id and o.status <> 'cancelado')) as cash_expected
  from sales.cash_sessions s;
