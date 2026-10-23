-- Anulaciones, reembolsos y devoluciones, etapa 8.
-- Anulación: efectivo (antes de entregar) o tarjeta sin pago confirmado. No mueve dinero.
-- Reembolso: pedido con pago confirmado que se cancela antes de completarse (trigger de la etapa 2 de Stripe).
--   El reembolso cuenta en el turno abierto cuando Stripe lo confirma (refund_session_id).
-- Devolución: solo pedidos entregados hace 3 días o menos. El cliente sube fotos; coordinación decide según la política.
--   Aprobada con tarjeta: pasa a la cola de reembolso. Aprobada en efectivo: el cajero devuelve el efectivo y sale de su turno.

alter table sales.orders add column refund_session_id uuid references sales.cash_sessions(id);

create table sales.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references sales.orders(id),
  client_id uuid not null references identity.profiles(id),
  reason text not null check (char_length(btrim(reason)) between 5 and 300),
  photos text[] not null check (cardinality(photos) between 1 and 5),
  status text not null default 'solicitada' check (status in ('solicitada', 'aprobada', 'rechazada')),
  decision_note text check (decision_note is null or char_length(decision_note) between 5 and 200),
  decided_by uuid references identity.profiles(id),
  decided_at timestamptz,
  cash_returned_at timestamptz,
  cash_return_session uuid references sales.cash_sessions(id),
  created_at timestamptz not null default now(),
  constraint return_decision_pair check ((status = 'solicitada') = (decided_at is null)),
  constraint return_cash_pair check ((cash_returned_at is null) = (cash_return_session is null))
);
alter table sales.return_requests enable row level security;
revoke all on sales.return_requests from public, anon, authenticated;

-- Devolución pedida por el cliente dentro de los 3 días posteriores a la entrega.
create or replace function public.request_return(p_order uuid, p_reason text, p_photos text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_photo text;
  v_id uuid;
begin
  select * into v_order from sales.orders where id = p_order;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.client_id is distinct from auth.uid() or not private.has_valid_session() then
    raise exception 'solo quien hizo el pedido puede pedir una devolución' using errcode = '42501';
  end if;
  if v_order.status <> 'entregado' then
    raise exception 'solo se devuelven pedidos entregados' using errcode = '22023';
  end if;
  if char_length(v_reason) not between 5 and 300 then
    raise exception 'describe el motivo (entre 5 y 300 caracteres)' using errcode = '22023';
  end if;
  if p_photos is null or cardinality(p_photos) not between 1 and 5 then
    raise exception 'adjunta de 1 a 5 fotos del producto' using errcode = '22023';
  end if;
  foreach v_photo in array p_photos loop
    if nullif(btrim(v_photo), '') is null then
      raise exception 'una de las fotos está vacía' using errcode = '22023';
    end if;
    -- Las fotos se suben a la carpeta del propio cliente (bucket devoluciones, ruta <id_cliente>/...).
    if split_part(v_photo, '/', 1) <> auth.uid()::text then
      raise exception 'las fotos deben subirse a tu cuenta' using errcode = '22023';
    end if;
  end loop;
  if v_order.delivered_at < now() - interval '3 days' then
    raise exception 'las devoluciones se piden dentro de los 3 días posteriores a la entrega' using errcode = '22023';
  end if;
  begin
    insert into sales.return_requests (order_id, client_id, reason, photos)
    values (p_order, auth.uid(), v_reason, p_photos)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya existe una solicitud de devolución para este pedido' using errcode = '23505';
  end;
  perform private.write_audit('return.requested', 'order', p_order::text, null, jsonb_build_object('return', v_id));
  return v_id;
end $$;

-- Decisión de coordinación. Aprobar un pedido pagado con tarjeta lo pone en la cola de reembolso.
create or replace function public.decide_return(p_request uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req sales.return_requests;
  v_order sales.orders;
  v_note text := nullif(btrim(p_note), '');
begin
  if not private.is_coordination_console() then
    raise exception 'solo coordinación decide las devoluciones' using errcode = '42501';
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

-- El cajero devuelve al cliente el efectivo de una devolución aprobada. Sale de su turno abierto.
create or replace function public.return_cash_to_customer(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req sales.return_requests;
  v_order sales.orders;
  v_session sales.cash_sessions;
begin
  perform private.require_cashier();
  select * into v_req from sales.return_requests where id = p_request for update;
  if not found then
    raise exception 'solicitud no encontrada' using errcode = 'P0002';
  end if;
  if v_req.status <> 'aprobada' then
    raise exception 'la devolución no está aprobada' using errcode = '22023';
  end if;
  if v_req.cash_returned_at is not null then
    raise exception 'este efectivo ya fue devuelto' using errcode = '23505';
  end if;
  select * into v_order from sales.orders where id = v_req.order_id;
  if v_order.payment_method <> 'efectivo' then
    raise exception 'este pedido se reembolsa a su tarjeta' using errcode = '22023';
  end if;
  if v_order.cash_received_at is null then
    raise exception 'el efectivo de este pedido todavía no está en caja' using errcode = '22023';
  end if;
  select * into v_session from sales.cash_sessions where cashier_id = auth.uid() and closed_at is null;
  if not found then
    raise exception 'abre un turno de caja antes de devolver efectivo' using errcode = 'P0002';
  end if;
  update sales.return_requests set cash_returned_at = now(), cash_return_session = v_session.id where id = v_req.id;
  perform private.write_audit('return.cash_returned', 'order', v_order.id::text, null, jsonb_build_object('session', v_session.id, 'amount', v_order.total));
end $$;

-- Totales del turno por medio de pago. Un pago cuenta en el turno donde se cobró, aunque después se cancele.
create or replace function private.cash_breakdown(p_session uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'efectivo_mostrador', coalesce(sum(o.total) filter (where o.channel = 'mostrador' and o.payment_method = 'efectivo' and o.cash_session_id = p_session and o.status <> 'cancelado'), 0),
    'efectivo_web_recibido', coalesce(sum(o.total) filter (where o.cash_received_session = p_session and o.status <> 'cancelado'), 0),
    'efectivo_devuelto', (select coalesce(sum(x.total), 0) from sales.return_requests r join sales.orders x on x.id = r.order_id where r.cash_return_session = p_session),
    'tarjeta_mostrador', coalesce(sum(o.total) filter (where o.channel = 'mostrador' and o.payment_method = 'tarjeta' and o.cash_session_id = p_session and o.status <> 'cancelado'), 0),
    'tarjeta_web', coalesce(sum(o.total) filter (where o.channel = 'web' and o.payment_method = 'tarjeta' and o.cash_session_id = p_session
                                                    and o.payment_status in ('pagado', 'reembolso_pendiente', 'reembolsado')), 0),
    'reembolsos_tarjeta', coalesce(sum(o.total) filter (where o.refund_session_id = p_session and o.payment_status = 'reembolsado'), 0))
  from sales.orders o
  where o.cash_session_id = p_session or o.cash_received_session = p_session or o.refund_session_id = p_session;
$$;

-- Efectivo esperado: monto inicial + efectivo de mostrador + efectivo web recibido - efectivo devuelto al cliente.
create or replace function private.expected_cash(p_session uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select s.opening_amount
       + (b.v ->> 'efectivo_mostrador')::numeric
       + (b.v ->> 'efectivo_web_recibido')::numeric
       - (b.v ->> 'efectivo_devuelto')::numeric
  from sales.cash_sessions s
  cross join lateral (select private.cash_breakdown(s.id) as v) b
  where s.id = p_session;
$$;

-- Al cerrar, el efectivo esperado ya incluye las devoluciones: se recalcula el cierre igual que en la etapa 5.
-- Los reembolsos confirmados por Stripe se asignan al turno abierto; si no hay ninguno, al siguiente que se abra.
create or replace function public.mark_order_refunded(p_order uuid, p_refund text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_order sales.orders;
begin
  if p_refund is null or p_refund !~ '^re_[A-Za-z0-9_]{8,200}$' then
    raise exception 'reembolso inválido' using errcode = '22023';
  end if;
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.payment_status <> 'reembolso_pendiente' then
    raise exception 'el pedido no espera un reembolso' using errcode = '22023';
  end if;
  update sales.orders
     set payment_status = 'reembolsado', refund_id = p_refund, updated_at = now(),
         refund_session_id = (select s.id from sales.cash_sessions s where s.closed_at is null order by s.opened_at desc limit 1)
   where id = p_order;
  perform private.write_audit('order.refunded', 'order', p_order::text);
end $$;

-- Al abrir turno también recogen los reembolsos que se confirmaron sin turno abierto.
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
  update sales.orders set refund_session_id = v_id, updated_at = now()
   where payment_method = 'tarjeta' and payment_status = 'reembolsado' and refund_session_id is null;
  perform private.write_audit('cash_session.opened', 'cash_session', v_id::text, null, jsonb_build_object('opening', v_opening));
  return v_id;
end $$;

revoke all on function public.request_return(uuid, text, text[]), public.decide_return(uuid, text, text),
  public.return_cash_to_customer(uuid) from public, anon;
grant execute on function public.request_return(uuid, text, text[]), public.decide_return(uuid, text, text),
  public.return_cash_to_customer(uuid) to authenticated;

-- Efectivo devuelto al cliente en un turno. Lo usa la vista de turnos sin dar lectura directa a las devoluciones.
create or replace function private.cash_returned_total(p_session uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(x.total), 0) from sales.return_requests r join sales.orders x on x.id = r.order_id
   where r.cash_return_session = p_session;
$$;
grant execute on function private.cash_returned_total(uuid) to authenticated;

-- Efectivo de pedidos web que el cajero recibió en el turno. Las políticas de pedidos no dejan al cajero ver pedidos web.
create or replace function private.cash_received_web_total(p_session uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(o.total), 0) from sales.orders o where o.cash_received_session = p_session and o.status <> 'cancelado';
$$;
grant execute on function private.cash_received_web_total(uuid) to authenticated;

-- La vista de turnos calcula el efectivo esperado igual que el cierre.
create or replace view public.cash_sessions_list with (security_invoker = true) as
  select s.id, s.cashier_id, s.opened_at, s.opening_amount, s.closed_at, s.expected_amount, s.counted_amount, s.difference, s.note,
         (select count(*) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado') as sales_count,
         (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado') as sales_total,
         (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado' and o.payment_method = 'efectivo') as cash_total,
         coalesce(s.expected_amount, s.opening_amount
           + (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.channel = 'mostrador' and o.payment_method = 'efectivo' and o.status <> 'cancelado')
           + private.cash_received_web_total(s.id)
           - private.cash_returned_total(s.id)) as cash_expected
  from sales.cash_sessions s;
