-- Arqueo y cierre de caja, etapa 3: efectivo que entrega el repartidor.
-- 1) El repartidor registra el cobro al entregar el pedido en efectivo. El sistema genera el código CE-XXXXXX.
--    Hoy los repartidores no tienen cuenta: lo registra la consola de coordinación (pantalla temporal).
--    Cuando tengan cuenta, también podrá hacerlo el repartidor vinculado (identity.couriers.user_id).
-- 2) El cajero recibe el efectivo físico. Queda en su turno abierto.

create or replace function public.register_courier_cash(p_order uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_code text;
begin
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if not (private.is_coordination_console()
          or exists (select 1 from identity.couriers c where c.id = v_order.courier_id and c.user_id = auth.uid())) then
    raise exception 'no puedes registrar el efectivo de este pedido' using errcode = '42501';
  end if;
  if v_order.payment_method <> 'efectivo' then
    raise exception 'este pedido no se paga en efectivo' using errcode = '22023';
  end if;
  if v_order.status <> 'entregado' then
    raise exception 'el efectivo se registra al entregar el pedido' using errcode = '22023';
  end if;
  if v_order.payment_ref is not null then
    raise exception 'el efectivo de este pedido ya fue registrado' using errcode = '23505';
  end if;
  v_code := 'CE-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  update sales.orders set payment_ref = v_code, updated_at = now() where id = p_order;
  perform private.write_audit('order.courier_cash_registered', 'order', p_order::text, null, jsonb_build_object('code', v_code));
  return v_code;
end $$;

create or replace function public.receive_courier_cash(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_session sales.cash_sessions;
begin
  perform private.require_cashier();
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.payment_method <> 'efectivo' or v_order.payment_ref is null then
    raise exception 'el repartidor aún no registra el efectivo de este pedido' using errcode = '22023';
  end if;
  if v_order.cash_received_at is not null then
    raise exception 'este efectivo ya fue recibido' using errcode = '23505';
  end if;
  select * into v_session from sales.cash_sessions where cashier_id = auth.uid() and closed_at is null;
  if not found then
    raise exception 'abre un turno de caja antes de recibir efectivo' using errcode = 'P0002';
  end if;
  update sales.orders set cash_received_at = now(), cash_received_session = v_session.id, updated_at = now()
   where id = p_order;
  perform private.write_audit('order.courier_cash_received', 'order', p_order::text, null,
    jsonb_build_object('session', v_session.id, 'code', v_order.payment_ref));
end $$;

revoke all on function public.register_courier_cash(uuid), public.receive_courier_cash(uuid) from public, anon;
grant execute on function public.register_courier_cash(uuid), public.receive_courier_cash(uuid) to authenticated;
