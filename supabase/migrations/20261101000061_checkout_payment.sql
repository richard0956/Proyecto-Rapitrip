-- Entregas express y programadas, etapa 5: pago con tarjeta de toda la compra.
-- Diseño: docs/informe/2026-10-21-entregas-express-programado-design.md.
--
-- Una compra con tarjeta y varios pedidos se paga con UNA sesión de Stripe (un solo cobro). Todo ocurre a nivel de la compra:
--   * `create_checkout` deja la compra en `payment_status = 'pendiente'` (con un solo pedido se sigue pagando el pedido).
--   * `record_checkout_payment_session` registra la sesión y fija monto y moneda esperados: la suma de los pedidos que aún esperan pago.
--   * `apply_stripe_checkout_event` marca pagados todos esos pedidos o, si la sesión vence, cancela los que quedan pendientes.
--     Un pedido que el cliente canceló entre crear la sesión y pagar queda en cola de reembolso (solo su parte).
--   * Un cobro tardío, doble o de otro monto se reembolsa completo (igual que en los pedidos sueltos).
--   * `claim_pending_refunds` devuelve el monto de cada reembolso: los pedidos de una compra pagada de una vez se reembolsan
--     por su parte (reembolso parcial sobre el mismo cobro); los demás, completos.
-- Todas estas funciones son solo para la clave de servicio: nunca las llama un navegador.

alter table sales.checkouts
  add column payment_status text not null default 'no_aplica' check (payment_status in ('no_aplica', 'pendiente', 'pagado', 'vencido')),
  add column payment_session_id text,
  add column payment_intent_id text,
  add column payment_amount bigint check (payment_amount is null or payment_amount >= 0),
  add column payment_currency text check (payment_currency is null or payment_currency ~ '^[a-z]{3}$');
create unique index checkouts_payment_session_idx on sales.checkouts (payment_session_id) where payment_session_id is not null;
create unique index checkouts_payment_intent_idx on sales.checkouts (payment_intent_id) where payment_intent_id is not null;

-- Varios pedidos comparten el mismo cobro: el índice del cobro ya no puede ser único.
drop index sales.orders_payment_intent_idx;
create index orders_payment_intent_idx on sales.orders (payment_intent_id) where payment_intent_id is not null;

create or replace view public.my_checkouts with (security_invoker = true) as
  select id, payment_method, total, order_count, created_at, payment_status
  from sales.checkouts where client_id = auth.uid();

-- El resultado de la compra incluye cómo se paga.
create or replace function private.checkout_result(p_checkout uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'checkout_id', c.id,
    'total', c.total,
    'payment_status', c.payment_status,
    'orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'order_id', o.id, 'number', o.number, 'store_id', o.store_id, 'store_name', o.store_name,
        'delivery_class', o.delivery_class, 'class_reason', o.class_reason, 'total', o.total, 'delivery_fee', o.delivery_fee,
        'eta_min_days', o.eta_min_days, 'eta_max_days', o.eta_max_days) order by o.number)
      from sales.orders o where o.checkout_id = c.id), '[]'::jsonb))
  from sales.checkouts c where c.id = p_checkout;
$$;

-- `create_checkout` con el estado de pago de la compra (el resto de la función no cambia).
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

  -- Con tarjeta y varios pedidos, la compra se paga de una vez (una sola sesión de Stripe); con un pedido se paga el pedido.
  update sales.checkouts
     set total = v_total, order_count = v_count,
         payment_status = case when p_payment_method = 'tarjeta' and v_count > 1 then 'pendiente' else 'no_aplica' end
   where id = v_checkout;
  perform private.write_audit('checkout.created', 'checkout', v_checkout::text, null,
    jsonb_build_object('orders', v_count, 'total', v_total));
  return private.checkout_result(v_checkout);
end $$;


-- Un pedido de una compra que se paga de una vez no puede abrir su propia sesión: se pagaría dos veces.
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
  if v_order.checkout_id is not null
     and exists (select 1 from sales.checkouts c where c.id = v_order.checkout_id and c.payment_status <> 'no_aplica') then
    raise exception 'este pedido se paga junto con su compra' using errcode = '22023';
  end if;
  v_amount := round(v_order.total * 100)::bigint;
  update sales.orders
     set payment_session_id = p_session, payment_amount = v_amount, payment_currency = lower(p_currency), updated_at = now()
   where id = p_order;
  perform private.write_audit('order.payment_session_created', 'order', p_order::text, null,
    jsonb_build_object('amount', v_amount, 'currency', lower(p_currency)));
  return jsonb_build_object('previous_session', v_order.payment_session_id, 'amount', v_amount);
end $$;

-- Registra la sesión de pago de toda la compra. El monto esperado es la suma de los pedidos que aún esperan pago; cada uno
-- queda marcado (payment_amount) como incluido en el cobro, para saber qué devolver si se cancela antes de que el pago llegue.
create or replace function public.record_checkout_payment_session(p_checkout uuid, p_session text, p_currency text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_checkout sales.checkouts;
  v_amount bigint;
  v_pending int;
begin
  if p_session is null or p_session !~ '^cs_[A-Za-z0-9_]{8,200}$' then
    raise exception 'sesión de pago inválida' using errcode = '22023';
  end if;
  if p_currency is null or lower(p_currency) !~ '^[a-z]{3}$' then
    raise exception 'moneda inválida' using errcode = '22023';
  end if;
  select * into v_checkout from sales.checkouts where id = p_checkout for update;
  if not found then
    raise exception 'compra no encontrada' using errcode = 'P0002';
  end if;
  if v_checkout.payment_method <> 'tarjeta' or v_checkout.payment_status <> 'pendiente' then
    raise exception 'la compra no espera un pago' using errcode = '22023';
  end if;
  perform 1 from sales.orders where checkout_id = p_checkout order by number for update;
  select count(*), coalesce(sum(round(o.total * 100)), 0)::bigint into v_pending, v_amount
    from sales.orders o where o.checkout_id = p_checkout and o.status = 'pendiente_pago';
  if v_pending = 0 then
    raise exception 'la compra no tiene pedidos esperando pago' using errcode = '22023';
  end if;
  update sales.orders
     set payment_amount = round(total * 100)::bigint, payment_currency = lower(p_currency), updated_at = now()
   where checkout_id = p_checkout and status = 'pendiente_pago';
  update sales.checkouts
     set payment_session_id = p_session, payment_amount = v_amount, payment_currency = lower(p_currency)
   where id = p_checkout;
  perform private.write_audit('checkout.payment_session_created', 'checkout', p_checkout::text, null,
    jsonb_build_object('amount', v_amount, 'currency', lower(p_currency), 'orders', v_pending));
  return jsonb_build_object('previous_session', v_checkout.payment_session_id, 'amount', v_amount);
end $$;

-- Aplica un evento de Stripe de una compra ya verificado. Devuelve el resultado:
--   pagado | pagado_parcial | cancelado | ignorado            (nada más que hacer; en pagado_parcial la cola de reembolsos devuelve lo cancelado)
--   reembolsar_tarde | reembolsar_monto | reembolsar_doble     (el webhook debe reembolsar el cobro completo)
--   duplicado:<resultado anterior>                             (evento ya procesado; si el anterior era reembolsar_*, se reintenta el reembolso)
create or replace function public.apply_stripe_checkout_event(
  p_event_id text, p_type text, p_checkout uuid, p_session text, p_intent text, p_amount bigint, p_currency text, p_paid boolean
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_checkout sales.checkouts;
  v_previous text;
  v_outcome text;
  v_refunded int := 0;
  r sales.orders;
begin
  if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9_]{8,200}$' then
    raise exception 'evento inválido' using errcode = '22023';
  end if;
  insert into sales.payment_events (event_id, event_type, order_id, outcome)
  values (p_event_id, left(p_type, 80), p_checkout, 'procesando')
  on conflict (event_id) do nothing;
  if not found then
    select outcome into v_previous from sales.payment_events where event_id = p_event_id;
    return 'duplicado:' || coalesce(v_previous, '');
  end if;

  select * into v_checkout from sales.checkouts where id = p_checkout for update;
  if not found then
    v_outcome := 'ignorado';
  elsif p_type = 'checkout.session.completed' then
    if p_paid is not true then
      v_outcome := 'ignorado';
    elsif v_checkout.payment_status = 'pendiente'
          and v_checkout.payment_session_id is not distinct from p_session
          and v_checkout.payment_amount is not distinct from p_amount
          and v_checkout.payment_currency is not distinct from lower(p_currency) then
      update sales.checkouts set payment_status = 'pagado', payment_intent_id = p_intent where id = p_checkout;
      for r in select * from sales.orders where checkout_id = p_checkout and payment_amount is not null order by number for update loop
        update sales.orders set payment_intent_id = p_intent where id = r.id;
        if r.status = 'pendiente_pago' then
          perform public.mark_order_paid(r.id);
        elsif r.status in ('cancelado', 'rechazado') then
          -- Se canceló después de crearse la sesión y antes de que el pago llegara: se cobró, así que se devuelve su parte.
          update sales.orders set payment_status = 'reembolso_pendiente', updated_at = now() where id = r.id;
          perform private.write_audit('order.refund_queued', 'order', r.id::text, null,
            jsonb_build_object('number', r.number, 'status', r.status, 'reason', 'cancelado antes de llegar el pago'));
          v_refunded := v_refunded + 1;
        end if;
      end loop;
      v_outcome := case when v_refunded > 0 then 'pagado_parcial' else 'pagado' end;
    elsif v_checkout.payment_status = 'pagado' and v_checkout.payment_intent_id is not distinct from p_intent then
      v_outcome := 'ignorado';
    elsif v_checkout.payment_status = 'pagado' then
      v_outcome := 'reembolsar_doble';
    elsif v_checkout.payment_status = 'pendiente' then
      v_outcome := 'reembolsar_monto';
    else
      v_outcome := 'reembolsar_tarde';
    end if;
  elsif p_type = 'checkout.session.expired' then
    if v_checkout.payment_status = 'pendiente' and v_checkout.payment_session_id is not distinct from p_session then
      for r in select * from sales.orders where checkout_id = p_checkout and status = 'pendiente_pago' order by number for update loop
        update sales.orders set status = 'cancelado', status_reason = 'pago no completado', expires_at = null, updated_at = now() where id = r.id;
        perform private.release_order_stock(r.id, 'Pedido ' || r.number || ' sin pago');
        insert into sales.order_events (order_id, from_status, to_status, reason) values (r.id, 'pendiente_pago', 'cancelado', 'pago no completado');
        perform private.write_audit('order.payment_expired', 'order', r.id::text);
      end loop;
      update sales.checkouts set payment_status = 'vencido' where id = p_checkout and payment_status = 'pendiente';
      perform private.write_audit('checkout.payment_expired', 'checkout', p_checkout::text);
      v_outcome := 'cancelado';
    else
      v_outcome := 'ignorado';
    end if;
  else
    v_outcome := 'ignorado';
  end if;

  update sales.payment_events set outcome = v_outcome, updated_at = now() where event_id = p_event_id;
  if v_outcome like 'reembolsar%' then
    perform private.write_audit('checkout.payment_refund_needed', 'checkout', p_checkout::text, null, jsonb_build_object('reason', v_outcome));
  end if;
  return v_outcome;
end $$;

-- Si ya no queda ningún pedido de la compra esperando pago (vencieron o el cliente los canceló), la compra vence.
create or replace function private.expire_checkout_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update sales.checkouts c set payment_status = 'vencido'
   where c.id = new.checkout_id and c.payment_status = 'pendiente'
     and not exists (select 1 from sales.orders o where o.checkout_id = c.id and o.status = 'pendiente_pago');
  return null;
end $$;

create trigger expire_checkout_payment
  after update of status on sales.orders
  for each row
  when (new.checkout_id is not null and old.status = 'pendiente_pago' and new.status in ('cancelado', 'rechazado'))
  execute function private.expire_checkout_payment();

-- Cola de reembolsos: ahora indica el monto. Los pedidos de una compra pagada de una vez se devuelven por su parte
-- (reembolso parcial sobre el mismo cobro); los demás, completos (monto nulo).
drop function public.claim_pending_refunds(int);
create or replace function public.claim_pending_refunds(p_limit int default 20)
returns table (order_id uuid, order_number bigint, payment_intent_id text, amount_cents bigint)
language sql security definer set search_path = '' as $$
  select o.id, o.number, o.payment_intent_id,
         case when exists (select 1 from sales.checkouts c where c.id = o.checkout_id and c.payment_status <> 'no_aplica')
              then round(o.total * 100)::bigint end
    from sales.orders o
   where o.payment_status = 'reembolso_pendiente' and o.payment_intent_id is not null
   order by o.updated_at
   limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.record_order_checkout_session(uuid, text, text),
  public.record_checkout_payment_session(uuid, text, text),
  public.apply_stripe_checkout_event(text, text, uuid, text, text, bigint, text, boolean),
  public.claim_pending_refunds(int)
from public, anon, authenticated;
grant execute on function public.record_order_checkout_session(uuid, text, text),
  public.record_checkout_payment_session(uuid, text, text),
  public.apply_stripe_checkout_event(text, text, uuid, text, text, bigint, text, boolean),
  public.claim_pending_refunds(int)
to service_role;
-- La pantalla de excepciones también lista los cobros de una compra pagada de una vez que hay que reembolsar completos.
create or replace view public.payment_events_list with (security_invoker = true) as
  select e.event_id, e.event_type, e.order_id, o.number as order_number, e.outcome, e.received_at, e.updated_at,
         (c.id is not null) as for_checkout
  from sales.payment_events e
  left join sales.orders o on o.id = e.order_id
  left join sales.checkouts c on c.id = e.order_id
  where e.outcome like 'reembolsar%';

revoke all on function private.expire_checkout_payment() from public, anon, authenticated;
