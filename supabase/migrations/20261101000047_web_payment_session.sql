-- Arqueo y cierre de caja, etapa 2: un pago web con tarjeta entra al turno abierto cuando la pasarela confirma el pago.
-- Si no hay turno abierto, el pedido queda pendiente (cash_session_id nulo) y el siguiente turno que se abra lo recoge.
-- Cuando hay varios turnos abiertos, entra al más reciente (decisión propia, ver el plan).

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
         expires_at = now() + interval '45 minutes', updated_at = now(),
         cash_session_id = (select s.id from sales.cash_sessions s where s.closed_at is null order by s.opened_at desc limit 1)
   where id = p_order;
  insert into sales.order_events (order_id, from_status, to_status, reason)
  values (p_order, 'pendiente_pago', 'por_confirmar', 'pago recibido');
  perform private.write_audit('order.paid', 'order', p_order::text);
end $$;

-- Al abrir un turno, recoge los pagos web con tarjeta confirmados que quedaron sin turno.
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
  update sales.orders set cash_session_id = v_id, updated_at = now()
   where channel = 'web' and payment_method = 'tarjeta' and payment_status = 'pagado'
     and cash_session_id is null and status <> 'cancelado';
  perform private.write_audit('cash_session.opened', 'cash_session', v_id::text, null, jsonb_build_object('opening', p_opening));
  return v_id;
end $$;
