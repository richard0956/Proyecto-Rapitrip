-- Devoluciones, etapa 9: la decisión la toma administración (no coordinación), la caja ve el efectivo pendiente de devolver
-- y administración ve las solicitudes con sus fotos.

create or replace function public.decide_return(p_request uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req sales.return_requests;
  v_order sales.orders;
  v_note text := nullif(btrim(p_note), '');
begin
  if not private.is_admin_console() then
    raise exception 'solo administración decide las devoluciones' using errcode = '42501';
  end if;
  select * into v_req from sales.return_requests where id = p_request for update;
  if not found then
    raise exception 'solicitud no encontrada' using errcode = 'P0002';
  end if;
  if v_req.status <> 'solicitada' then
    raise exception 'la solicitud ya tiene decisión' using errcode = '22023';
  end if;
  if p_decision is null or p_decision not in ('aprobada', 'rechazada') then
    raise exception 'decisión inválida' using errcode = '22023';
  end if;
  if v_note is null or char_length(v_note) < 5 then
    raise exception 'explica la decisión (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  select * into v_order from sales.orders where id = v_req.order_id for update;
  if p_decision = 'aprobada' and v_order.payment_method = 'tarjeta' then
    if v_order.payment_status <> 'pagado' or v_order.payment_intent_id is null then
      raise exception 'el pago de este pedido no se puede reembolsar' using errcode = '22023';
    end if;
    update sales.orders set payment_status = 'reembolso_pendiente', updated_at = now() where id = v_order.id;
  end if;
  update sales.return_requests
     set status = p_decision, decision_note = v_note, decided_by = auth.uid(), decided_at = now()
   where id = v_req.id;
  perform private.write_audit('return.' || p_decision, 'order', v_order.id::text, null, jsonb_build_object('return', v_req.id), v_note);
end $$;

-- Efectivo de devoluciones aprobadas que el cajero aún no ha devuelto al cliente.
create or replace function public.pending_cash_returns()
returns table (request_id uuid, order_number bigint, store_name text, total numeric, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_cashier();
  return query
    select r.id, o.number, o.store_name, o.total, r.decided_at
      from sales.return_requests r
      join sales.orders o on o.id = r.order_id
     where r.status = 'aprobada' and o.payment_method = 'efectivo' and r.cash_returned_at is null and o.cash_received_at is not null
     order by r.decided_at;
end $$;

-- Lista de solicitudes para administración, con su motivo, fotos y decisión.
create or replace function public.return_requests_for_admin()
returns table (request_id uuid, order_number bigint, store_name text, total numeric, payment_method text, status text,
               reason text, photos text[], decision_note text, requested_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin_console() then
    raise exception 'solo administración ve las devoluciones' using errcode = '42501';
  end if;
  return query
    select r.id, o.number, o.store_name, o.total, o.payment_method, r.status, r.reason, r.photos, r.decision_note, r.created_at, r.decided_at
      from sales.return_requests r
      join sales.orders o on o.id = r.order_id
     order by r.status = 'solicitada' desc, r.created_at desc;
end $$;

revoke all on function public.decide_return(uuid, text, text), public.pending_cash_returns(), public.return_requests_for_admin()
  from public, anon;
grant execute on function public.decide_return(uuid, text, text), public.pending_cash_returns(), public.return_requests_for_admin()
  to authenticated;
