-- Repartidor, etapa 5: acciones del repartidor sobre sus pedidos.
-- Diseño: docs/informe/2026-10-23-repartidor-revision-evidencias-y-consolas.md (secciones 2 y 5).
--
--   * courier_pick_up : listo -> en_camino. Exige la foto de recogida y el código de recogida que ve el comercio.
--   * courier_deliver : en_camino -> entregado. Exige la foto de entrega y el código que ve el cliente; en efectivo, el monto
--     cobrado (y una nota si no coincide con el total), y deja registrado el código CE que luego recibe el cajero.
--   * courier_report_problem / courier_release_order : avisan a coordinación (no cambian el estado, salvo devolver el pedido
--     antes de recogerlo, que lo deja sin repartidor).
--   * Coordinación puede seguir despachando y entregando por un repartidor CON cuenta, pero ahora debe indicar el motivo
--     cuando falta evidencia, y queda auditado. Un repartidor SIN cuenta se despacha como siempre (sin evidencia).
--
-- Los resultados que dejan algo guardado (código incorrecto contado, foto pendiente) se DEVUELVEN como texto en vez de lanzar un
-- error, porque un error deshace lo guardado en esa misma llamada.

-- Efectivo cobrado --------------------------------------------------------------------------------------------------------
alter table sales.orders add column cash_collected numeric(12, 2) check (cash_collected is null or cash_collected >= 0);

create or replace view public.orders_list with (security_invoker = true) as
  select id, number, client_id, store_id, store_name, commerce_id, status, payment_method, payment_status, subtotal, delivery_fee,
         total, courier_id, status_reason, expires_at, created_at, updated_at, confirmed_at, delivered_at,
         (select coalesce(sum(i.quantity), 0) from sales.order_items i where i.order_id = o.id) as item_count,
         channel, cashier_id, cash_session_id, payment_ref, cash_received_at, checkout_id, delivery_class, class_reason,
         origin_department, destination_department, eta_min_days, eta_max_days, reclassified_at, reclassified_reason,
         cash_collected
  from sales.orders o;

-- Problemas que el repartidor avisa a coordinación -------------------------------------------------------------------------
create table sales.delivery_issues (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sales.orders(id) on delete cascade,
  courier_id uuid not null references identity.couriers(id),
  kind text not null check (kind in ('no_entregado', 'no_cabe', 'problema', 'devuelto')),
  reason text not null check (char_length(reason) between 5 and 200),
  status text not null default 'abierta' check (status in ('abierta', 'atendida')),
  created_at timestamptz not null default now(),
  attended_by uuid,
  attended_at timestamptz,
  attended_note text check (attended_note is null or char_length(attended_note) between 3 and 200),
  constraint issue_attended_pair check ((status = 'atendida') = (attended_at is not null))
);
create unique index delivery_issues_one_open on sales.delivery_issues (order_id, kind) where status = 'abierta';
create index delivery_issues_open_idx on sales.delivery_issues (created_at desc) where status = 'abierta';
alter table sales.delivery_issues enable row level security;
create policy delivery_issues_select_coordination on sales.delivery_issues
  for select to authenticated using (private.is_coordination_console());
grant select on sales.delivery_issues to authenticated;

create view public.delivery_issues_list with (security_invoker = true) as
  select id, order_id, courier_id, kind, reason, status, created_at, attended_by, attended_at, attended_note
  from sales.delivery_issues;
revoke all on public.delivery_issues_list from public, anon;
grant select on public.delivery_issues_list to authenticated;

create or replace function public.resolve_delivery_issue(p_issue uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v sales.delivery_issues;
  v_note text := nullif(btrim(p_note), '');
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes atender avisos de repartidores' using errcode = '42501';
  end if;
  if v_note is null or char_length(v_note) not between 3 and 200 then
    raise exception 'indica qué se hizo (entre 3 y 200 caracteres)' using errcode = '22023';
  end if;
  select * into v from sales.delivery_issues where id = p_issue for update;
  if not found then
    raise exception 'aviso no encontrado' using errcode = 'P0002';
  end if;
  if v.status = 'atendida' then
    raise exception 'ese aviso ya fue atendido' using errcode = '22023';
  end if;
  update sales.delivery_issues set status = 'atendida', attended_by = auth.uid(), attended_at = now(), attended_note = v_note where id = p_issue;
  perform private.write_audit('order.issue_resolved', 'order', v.order_id::text, null,
    jsonb_build_object('issue_id', p_issue, 'kind', v.kind), v_note);
end $$;

-- Evidencia que falta (para cuando coordinación despacha o entrega por un repartidor con cuenta) ------------------------------
-- Devuelve 'recogida' o 'entrega' si la evidencia exigida por las reglas no está completa; si no, nulo.
create or replace function private.order_evidence_missing(p_order sales.orders, p_to text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_set sales.evidence_settings;
  v_codes sales.order_codes;
begin
  select * into v_set from sales.evidence_settings;
  select * into v_codes from sales.order_codes where order_id = p_order.id;
  if p_to = 'en_camino' then
    if v_set.require_pickup_photo and not exists (select 1 from sales.delivery_evidence e where e.order_id = p_order.id and e.kind = 'recogida') then
      return 'recogida';
    end if;
    if v_set.require_pickup_code and v_codes.pickup_verified_at is null then
      return 'recogida';
    end if;
  elsif p_to = 'entregado' then
    if v_set.require_delivery_photo and not exists (select 1 from sales.delivery_evidence e where e.order_id = p_order.id and e.kind = 'entrega') then
      return 'entrega';
    end if;
    if v_set.require_delivery_code and v_codes.delivery_verified_at is null then
      return 'entrega';
    end if;
  end if;
  return null;
end $$;
revoke all on function private.order_evidence_missing(sales.orders, text) from public, anon, authenticated;

-- set_order_status: igual que la migración 73, más el control de evidencia al despachar y entregar ---------------------------
create or replace function public.set_order_status(p_order uuid, p_to text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_coord boolean;
  v_shop boolean;
  v_client boolean;
  v_allowed boolean := false;
  v_reason text := nullif(btrim(p_reason), '');
  v_missing text;
begin
  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if p_to is null or p_to not in ('en_validacion', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado', 'cancelado', 'rechazado') then
    raise exception 'estado no válido' using errcode = '22023';
  end if;
  if v_order.status in ('entregado', 'cancelado', 'rechazado') then
    raise exception 'el pedido ya terminó y no admite cambios' using errcode = '22023';
  end if;

  v_client := v_order.client_id = auth.uid() and private.has_valid_session();
  v_coord := private.is_coordination_console();
  v_shop := private.has_role('comercio', v_order.commerce_id) and private.has_strong_session();
  if not (v_client or v_coord or v_shop) then
    raise exception 'no puedes cambiar este pedido' using errcode = '42501';
  end if;

  if p_to in ('cancelado', 'rechazado') and (v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 200) then
    raise exception 'indica el motivo (entre 5 y 200 caracteres)' using errcode = '22023';
  end if;

  if p_to = 'cancelado' then
    v_allowed := (v_client and v_order.status in ('pendiente_pago', 'por_confirmar', 'en_validacion'))
              or (v_shop and v_order.status in ('por_confirmar', 'en_validacion', 'confirmado', 'preparando'))
              or v_coord;
  elsif p_to = 'rechazado' then
    v_allowed := (v_shop or v_coord) and v_order.status in ('por_confirmar', 'en_validacion');
  elsif p_to = 'en_validacion' then
    v_allowed := (v_shop or v_coord) and v_order.status = 'por_confirmar' and v_order.delivery_class = 'programado';
  elsif p_to = 'confirmado' then
    v_allowed := (v_shop or v_coord) and v_order.status in ('por_confirmar', 'en_validacion');
  elsif p_to = 'preparando' then
    v_allowed := (v_shop or v_coord) and v_order.status = 'confirmado';
  elsif p_to = 'listo' then
    v_allowed := (v_shop or v_coord) and v_order.status = 'preparando';
  elsif p_to = 'en_camino' then
    v_allowed := v_coord and v_order.status = 'listo';
    if v_allowed and v_order.courier_id is null then
      raise exception 'asigna un repartidor antes de despachar el pedido' using errcode = '22023';
    end if;
    if v_allowed then
      perform private.assert_courier_fits(v_order, v_order.courier_id);
    end if;
  elsif p_to = 'entregado' then
    v_allowed := v_coord and v_order.status = 'en_camino';
  end if;
  if not v_allowed then
    raise exception 'ese cambio de estado no está permitido' using errcode = '42501';
  end if;

  -- Con un repartidor que tiene cuenta, la evidencia se completa con su aplicación; si coordinación la salta, debe decir por qué.
  if p_to in ('en_camino', 'entregado') and v_order.courier_id is not null
     and exists (select 1 from identity.couriers c where c.id = v_order.courier_id and c.user_id is not null) then
    v_missing := private.order_evidence_missing(v_order, p_to);
    if v_missing is not null then
      if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 200 then
        raise exception 'falta la evidencia de %: indica el motivo (entre 5 y 200 caracteres)', v_missing using errcode = '22023';
      end if;
      perform private.write_audit('order.evidence_skipped', 'order', p_order::text, null,
        jsonb_build_object('step', v_missing, 'to', p_to), v_reason);
    end if;
  end if;

  perform private.apply_order_transition(v_order, p_to, v_reason);
end $$;

-- Recoger ----------------------------------------------------------------------------------------------------------------------
-- Resultados: 'ok', 'falta_foto', 'incorrecto', 'bloqueado' o 'sin_codigo'. Los errores (42501, P0002, 22023) son de uso indebido.
create or replace function public.courier_pick_up(p_order uuid, p_code text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v_order sales.orders;
  v_set sales.evidence_settings;
  v_result text;
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa recoge pedidos' using errcode = '42501';
  end if;
  select * into v_order from sales.orders where id = p_order and courier_id = v_courier for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  -- Idempotente: repetir «recogí» por una mala señal no falla.
  if v_order.status = 'en_camino' and exists (select 1 from sales.delivery_evidence e where e.order_id = p_order and e.kind = 'recogida') then
    return 'ok';
  end if;
  if v_order.status <> 'listo' then
    raise exception 'el pedido aún no está listo para recoger' using errcode = '22023';
  end if;
  select * into v_set from sales.evidence_settings;
  if v_set.require_pickup_photo and not exists (select 1 from sales.delivery_evidence e where e.order_id = p_order and e.kind = 'recogida') then
    return 'falta_foto';
  end if;
  perform private.assert_courier_fits(v_order, v_courier);
  if v_set.require_pickup_code then
    v_result := private.verify_order_code(p_order, 'recogida', p_code);
    if v_result <> 'ok' then
      return v_result;
    end if;
  end if;
  perform private.apply_order_transition(v_order, 'en_camino', null);
  return 'ok';
end $$;

-- Entregar ---------------------------------------------------------------------------------------------------------------------
-- p_cash: monto cobrado, obligatorio solo si el pedido es en efectivo. Si no coincide con el total, p_note explica la diferencia.
-- p_received_by: quién recibió si no fue el cliente (vecino, portero…).
create or replace function public.courier_deliver(
  p_order uuid, p_code text default null, p_cash numeric default null, p_received_by text default null, p_note text default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v_order sales.orders;
  v_set sales.evidence_settings;
  v_note text := nullif(btrim(p_note), '');
  v_by text := nullif(btrim(p_received_by), '');
  v_result text;
  v_event text;
  v_cash_code text;
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa entrega pedidos' using errcode = '42501';
  end if;
  select * into v_order from sales.orders where id = p_order and courier_id = v_courier for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  -- Idempotente.
  if v_order.status = 'entregado' then
    return 'ok';
  end if;
  if v_order.status <> 'en_camino' then
    raise exception 'el pedido no va en camino' using errcode = '22023';
  end if;
  if v_by is not null and char_length(v_by) not between 2 and 80 then
    raise exception 'quién recibió debe tener entre 2 y 80 caracteres' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) not between 3 and 200 then
    raise exception 'la nota debe tener entre 3 y 200 caracteres' using errcode = '22023';
  end if;
  if v_order.payment_method = 'efectivo' then
    if p_cash is null or p_cash < 0 or p_cash > 99999999 then
      raise exception 'indica el monto que cobraste' using errcode = '22023';
    end if;
    if round(p_cash, 2) <> v_order.total and v_note is null then
      raise exception 'el monto no coincide con el total: explica la diferencia en la nota' using errcode = '22023';
    end if;
  elsif p_cash is not null then
    raise exception 'este pedido ya está pagado: no se cobra nada' using errcode = '22023';
  end if;

  select * into v_set from sales.evidence_settings;
  if v_set.require_delivery_photo and not exists (select 1 from sales.delivery_evidence e where e.order_id = p_order and e.kind = 'entrega') then
    return 'falta_foto';
  end if;
  if v_set.require_delivery_code then
    v_result := private.verify_order_code(p_order, 'entrega', p_code);
    if v_result <> 'ok' then
      return v_result;
    end if;
  end if;

  v_event := left(concat_ws(' · ', case when v_by is not null then 'Recibió: ' || v_by end, v_note), 200);
  perform private.apply_order_transition(v_order, 'entregado', nullif(v_event, ''));

  if v_order.payment_method = 'efectivo' then
    -- Mismo código CE que genera `register_courier_cash`; el cajero lo recibe después en la caja.
    v_cash_code := 'CE-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
    update sales.orders set payment_ref = v_cash_code, cash_collected = round(p_cash, 2), updated_at = now() where id = p_order;
    perform private.write_audit('order.courier_cash_registered', 'order', p_order::text, null,
      jsonb_build_object('code', v_cash_code, 'collected', round(p_cash, 2), 'difference', round(p_cash, 2) - v_order.total));
  end if;
  return 'ok';
end $$;

-- Código CE de un pedido en efectivo ya entregado, para que el repartidor lo lleve al cajero.
create or replace function public.courier_cash_code(p_order uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v_code text;
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa ve sus códigos de efectivo' using errcode = '42501';
  end if;
  select payment_ref into v_code from sales.orders where id = p_order and courier_id = v_courier and payment_method = 'efectivo' and status = 'entregado';
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  return v_code;
end $$;

-- Avisos a coordinación ----------------------------------------------------------------------------------------------------------
-- kinds: 'no_entregado' (en camino; exige la foto del intento), 'no_cabe' (antes de recoger, solo pedidos express),
-- 'problema' (cualquier pedido abierto). No cambian el estado del pedido. Idempotente: un aviso abierto del mismo tipo se reutiliza.
create or replace function public.courier_report_problem(p_order uuid, p_kind text, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v_order sales.orders;
  v_reason text := nullif(btrim(p_reason), '');
  v_id uuid;
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa avisa problemas' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('no_entregado', 'no_cabe', 'problema') then
    raise exception 'tipo de aviso no válido' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) not between 5 and 200 then
    raise exception 'cuenta qué pasó (entre 5 y 200 caracteres)' using errcode = '22023';
  end if;
  select * into v_order from sales.orders where id = p_order and courier_id = v_courier for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.status not in ('confirmado', 'preparando', 'listo', 'en_camino') then
    raise exception 'ese pedido ya no está abierto' using errcode = '22023';
  end if;
  if p_kind = 'no_entregado' then
    if v_order.status <> 'en_camino' then
      raise exception 'solo se avisa que no se pudo entregar un pedido en camino' using errcode = '22023';
    end if;
    if not exists (select 1 from sales.delivery_evidence e where e.order_id = p_order and e.kind = 'fallida') then
      raise exception 'sube primero la foto del intento de entrega' using errcode = '22023';
    end if;
  elsif p_kind = 'no_cabe' then
    if v_order.status = 'en_camino' then
      raise exception 'ya recogiste el pedido: avisa como problema' using errcode = '22023';
    end if;
    if v_order.delivery_class <> 'express' then
      raise exception 'solo un pedido express puede pasar a programado' using errcode = '22023';
    end if;
  end if;

  select id into v_id from sales.delivery_issues where order_id = p_order and kind = p_kind and status = 'abierta';
  if found then
    return v_id;
  end if;
  insert into sales.delivery_issues (order_id, courier_id, kind, reason)
  values (p_order, v_courier, p_kind, v_reason) returning id into v_id;
  perform private.write_audit('order.issue_reported', 'order', p_order::text, null,
    jsonb_build_object('issue_id', v_id, 'kind', p_kind), v_reason);
  return v_id;
end $$;

-- Devolver el pedido antes de recogerlo: queda sin repartidor y coordinación recibe un aviso para reasignarlo.
create or replace function public.courier_release_order(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v_order sales.orders;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa devuelve pedidos' using errcode = '42501';
  end if;
  if v_reason is null or char_length(v_reason) not between 5 and 200 then
    raise exception 'cuenta por qué lo devuelves (entre 5 y 200 caracteres)' using errcode = '22023';
  end if;
  select * into v_order from sales.orders where id = p_order and courier_id = v_courier for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.status not in ('confirmado', 'preparando', 'listo') then
    raise exception 'solo se devuelve un pedido que aún no recogiste' using errcode = '22023';
  end if;
  update sales.orders set courier_id = null, updated_at = now() where id = p_order;
  -- Si había un aviso «no cabe» abierto, la devolución lo reemplaza.
  update sales.delivery_issues set status = 'atendida', attended_at = now(), attended_note = 'Devuelto por el repartidor'
   where order_id = p_order and status = 'abierta' and kind <> 'devuelto' and courier_id = v_courier;
  insert into sales.delivery_issues (order_id, courier_id, kind, reason)
  values (p_order, v_courier, 'devuelto', v_reason)
  on conflict (order_id, kind) where status = 'abierta' do nothing;
  perform private.write_audit('order.courier_released', 'order', p_order::text, null,
    jsonb_build_object('courier_id', v_courier), v_reason);
end $$;

-- Avisos abiertos de un pedido propio (para que la app muestre «ya avisaste a coordinación»).
create or replace function public.courier_order_issues(p_order uuid)
returns table (issue_id uuid, kind text, reason text, status text, created_at timestamptz, attended_note text)
language plpgsql stable security definer set search_path = '' as $$
declare v_courier uuid := private.current_courier_id();
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa ve sus avisos' using errcode = '42501';
  end if;
  return query
    select i.id, i.kind, i.reason, i.status, i.created_at, i.attended_note
      from sales.delivery_issues i where i.order_id = p_order and i.courier_id = v_courier order by i.created_at desc;
end $$;

revoke all on function
  public.resolve_delivery_issue(uuid, text),
  public.courier_pick_up(uuid, text), public.courier_deliver(uuid, text, numeric, text, text), public.courier_cash_code(uuid),
  public.courier_report_problem(uuid, text, text), public.courier_release_order(uuid, text), public.courier_order_issues(uuid)
from public, anon;
grant execute on function
  public.resolve_delivery_issue(uuid, text),
  public.courier_pick_up(uuid, text), public.courier_deliver(uuid, text, numeric, text, text), public.courier_cash_code(uuid),
  public.courier_report_problem(uuid, text, text), public.courier_release_order(uuid, text), public.courier_order_issues(uuid)
to authenticated;
