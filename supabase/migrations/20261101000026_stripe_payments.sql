-- Fase 3: pagos con tarjeta (Stripe Checkout alojado).
--
-- Flujo:
--   1. La función de borde `stripe-checkout` crea la sesión de pago y la registra aquí (`record_order_checkout_session`),
--      que fija el monto y la moneda esperados.
--   2. Stripe avisa al webhook `stripe-webhook`, que valida la firma y llama a `apply_stripe_event`.
--      Esta función es idempotente (cada evento se procesa una sola vez), compara monto y moneda con lo registrado
--      y decide: marcar pagado, cancelar por sesión vencida, o pedir un reembolso (pago tarde, doble o de otro monto).
--   3. Si un pedido pagado con tarjeta se cancela o se rechaza, queda `reembolso_pendiente`; la función `process-refunds`
--      lo reembolsa en Stripe y lo marca `reembolsado`.
-- Todas las funciones de este archivo son solo para la clave de servicio: nunca las llama un navegador.

alter table sales.orders
  add column payment_session_id text,
  add column payment_intent_id text,
  add column payment_amount bigint check (payment_amount is null or payment_amount >= 0),
  add column payment_currency text check (payment_currency is null or payment_currency ~ '^[a-z]{3}$'),
  add column refund_id text;

alter table sales.orders drop constraint orders_payment_status_check;
alter table sales.orders add constraint orders_payment_status_check
  check (payment_status in ('pendiente', 'pagado', 'fallido', 'reembolso_pendiente', 'reembolsado'));

create unique index orders_payment_session_idx on sales.orders (payment_session_id) where payment_session_id is not null;
create unique index orders_payment_intent_idx on sales.orders (payment_intent_id) where payment_intent_id is not null;

-- Cada evento de Stripe se procesa una sola vez; aquí queda además el resultado, para auditar y reintentar reembolsos.
create table sales.payment_events (
  event_id text primary key,
  event_type text not null,
  order_id uuid,
  outcome text not null,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table sales.payment_events enable row level security;

-- Pedido pagado con tarjeta que se cancela o rechaza: queda en cola para reembolsarlo.
create or replace function private.queue_refund_on_cancel()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('cancelado', 'rechazado') and old.status not in ('cancelado', 'rechazado')
     and new.payment_method = 'tarjeta' and new.payment_status = 'pagado' then
    new.payment_status := 'reembolso_pendiente';
    perform private.write_audit('order.refund_queued', 'order', new.id::text, null,
      jsonb_build_object('number', new.number, 'status', new.status));
  end if;
  return new;
end $$;

create trigger queue_refund_on_cancel
  before update of status on sales.orders
  for each row execute function private.queue_refund_on_cancel();

-- Registra la sesión de pago creada en Stripe. Fija monto (en centavos) y moneda esperados y devuelve la sesión anterior,
-- para que la función de borde la venza y no queden dos sesiones abiertas.
create or replace function public.record_order_checkout_session(p_order uuid, p_session text, p_currency text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_amount bigint;
begin
  if p_session is null or p_session !~ '^cs_[A-Za-z0-9_]{8,200}$' then
    raise exception 'sesión de pago inválida' using errcode = '22023';
  end if;
  if p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
    raise exception 'moneda inválida' using errcode = '22023';
  end if;
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.payment_method <> 'tarjeta' or v_order.status <> 'pendiente_pago' then
    raise exception 'el pedido no espera un pago' using errcode = '22023';
  end if;
  v_amount := round(v_order.total * 100)::bigint;
  update sales.orders
     set payment_session_id = p_session, payment_amount = v_amount, payment_currency = lower(p_currency), updated_at = now()
   where id = p_order;
  perform private.write_audit('order.payment_session_created', 'order', p_order::text, null,
    jsonb_build_object('amount', v_amount, 'currency', lower(p_currency)));
  return jsonb_build_object('previous_session', v_order.payment_session_id, 'amount', v_amount);
end $$;

-- Aplica un evento de Stripe ya verificado. Devuelve el resultado:
--   pagado | cancelado | ignorado            (nada más que hacer)
--   reembolsar_tarde | reembolsar_monto | reembolsar_doble   (el webhook debe reembolsar el pago)
--   duplicado:<resultado anterior>           (evento ya procesado; si el anterior era reembolsar_*, se reintenta el reembolso)
create or replace function public.apply_stripe_event(
  p_event_id text, p_type text, p_order uuid, p_session text, p_intent text, p_amount bigint, p_currency text, p_paid boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_previous text;
  v_outcome text;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]{8,200}$' then
    raise exception 'evento inválido' using errcode = '22023';
  end if;
  insert into sales.payment_events (event_id, event_type, order_id, outcome)
  values (p_event_id, left(p_type, 80), p_order, 'procesando')
  on conflict (event_id) do nothing;
  if not found then
    select outcome into v_previous from sales.payment_events where event_id = p_event_id;
    return 'duplicado:' || coalesce(v_previous, '');
  end if;

  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    v_outcome := 'ignorado';
  elsif p_type = 'checkout.session.completed' then
    if p_paid is not true then
      v_outcome := 'ignorado';
    elsif v_order.status = 'pendiente_pago' and v_order.payment_status = 'pendiente'
          and v_order.payment_amount is not distinct from p_amount
          and v_order.payment_currency is not distinct from lower(p_currency) then
      update sales.orders set payment_intent_id = p_intent where id = p_order;
      perform public.mark_order_paid(p_order);
      v_outcome := 'pagado';
    elsif v_order.payment_intent_id is not distinct from p_intent and v_order.payment_status <> 'pendiente' then
      v_outcome := 'ignorado';
    elsif v_order.payment_status in ('pagado', 'reembolso_pendiente', 'reembolsado') then
      v_outcome := 'reembolsar_doble';
    elsif v_order.status = 'pendiente_pago' then
      v_outcome := 'reembolsar_monto';
    else
      v_outcome := 'reembolsar_tarde';
    end if;
  elsif p_type = 'checkout.session.expired' then
    if v_order.status = 'pendiente_pago' and v_order.payment_session_id is not distinct from p_session then
      update sales.orders set status = 'cancelado', status_reason = 'pago no completado', expires_at = null, updated_at = now()
       where id = p_order;
      perform private.release_order_stock(p_order, 'Pedido ' || v_order.number || ' sin pago');
      insert into sales.order_events (order_id, from_status, to_status, reason)
      values (p_order, 'pendiente_pago', 'cancelado', 'pago no completado');
      perform private.write_audit('order.payment_expired', 'order', p_order::text);
      v_outcome := 'cancelado';
    else
      v_outcome := 'ignorado';
    end if;
  else
    v_outcome := 'ignorado';
  end if;

  update sales.payment_events set outcome = v_outcome, updated_at = now() where event_id = p_event_id;
  if v_outcome like 'reembolsar%' then
    perform private.write_audit('order.payment_refund_needed', 'order', p_order::text, null,
      jsonb_build_object('reason', v_outcome));
  end if;
  return v_outcome;
end $$;

-- Tras reembolsar un pago tarde, doble o de otro monto: deja constancia de que ya se devolvió.
create or replace function public.set_payment_event_outcome(p_event_id text, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current text;
begin
  if p_outcome not in ('reembolsado_tarde', 'reembolsado_monto', 'reembolsado_doble') then
    raise exception 'resultado inválido' using errcode = '22023';
  end if;
  select outcome into v_current from sales.payment_events where event_id = p_event_id for update;
  if not found then
    raise exception 'evento no encontrado' using errcode = 'P0002';
  end if;
  if v_current <> replace(p_outcome, 'reembolsado', 'reembolsar') then
    raise exception 'el evento no esperaba un reembolso' using errcode = '22023';
  end if;
  update sales.payment_events set outcome = p_outcome, updated_at = now() where event_id = p_event_id;
end $$;

-- Cola de reembolsos de pedidos pagados que se cancelaron o rechazaron. El reembolso en Stripe es idempotente
-- (clave por pedido), así que reintentar es seguro.
create or replace function public.claim_pending_refunds(p_limit int default 20)
returns table (order_id uuid, order_number bigint, payment_intent_id text)
language sql security definer set search_path = '' as $$
  select o.id, o.number, o.payment_intent_id
    from sales.orders o
   where o.payment_status = 'reembolso_pendiente' and o.payment_intent_id is not null
   order by o.updated_at
   limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

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
  update sales.orders set payment_status = 'reembolsado', refund_id = p_refund, updated_at = now() where id = p_order;
  perform private.write_audit('order.refunded', 'order', p_order::text);
end $$;

revoke all on function public.record_order_checkout_session(uuid, text, text),
  public.apply_stripe_event(text, text, uuid, text, text, bigint, text, boolean),
  public.set_payment_event_outcome(text, text),
  public.claim_pending_refunds(int),
  public.mark_order_refunded(uuid, text)
from public, anon, authenticated;
grant execute on function public.record_order_checkout_session(uuid, text, text),
  public.apply_stripe_event(text, text, uuid, text, text, bigint, text, boolean),
  public.set_payment_event_outcome(text, text),
  public.claim_pending_refunds(int),
  public.mark_order_refunded(uuid, text)
to service_role;
