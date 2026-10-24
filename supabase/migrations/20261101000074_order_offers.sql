-- Repartidor, etapa 3: ofertas de pedido.
-- Diseño: docs/informe/2026-10-22-repartidor-ofertas-y-push-design.md y 2026-10-23-repartidor-revision-evidencias-y-consolas.md.
--
-- La coordinación PROPONE un pedido a UN repartidor a la vez; él acepta, rechaza o la deja vencer (3 minutos).
-- Solo al aceptar se le asigna el pedido (`orders.courier_id`), con las mismas reglas que `assign_order_courier`: el repartidor
-- debe estar activo y ser compatible (vehículo y departamento). «Asignar directamente» sigue existiendo como excepción.
--
--   * Una sola oferta pendiente por pedido y una sola por repartidor (índices únicos parciales).
--   * Aceptar es atómico: se bloquea la oferta y el pedido, y se vuelve a validar todo en ese instante.
--   * Rechazar y vencer no cambian el pedido: solo dejan la oferta marcada para que coordinación la reofrezca.
--   * La oferta se cancela sola si el pedido se asigna a otro, se cae, o el repartidor pierde la cuenta o la ficha.
--   * Los avisos push llegan en una etapa posterior; la oferta ya queda lista para engancharlos.

create table sales.order_offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sales.orders(id) on delete cascade,
  courier_id uuid not null references identity.couriers(id),
  status text not null default 'pendiente' check (status in ('pendiente', 'aceptada', 'rechazada', 'vencida', 'cancelada')),
  offered_by uuid not null,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) between 5 and 200),
  constraint offer_expiry_after_offer check (expires_at > offered_at)
);
create unique index order_offers_one_pending_per_order on sales.order_offers (order_id) where status = 'pendiente';
create unique index order_offers_one_pending_per_courier on sales.order_offers (courier_id) where status = 'pendiente';
create index order_offers_order_idx on sales.order_offers (order_id, offered_at desc);
create index order_offers_expiry_idx on sales.order_offers (expires_at) where status = 'pendiente';

alter table sales.order_offers enable row level security;
create policy order_offers_select_coordination on sales.order_offers
  for select to authenticated using (private.is_coordination_console());
grant select on sales.order_offers to authenticated;

-- Vigencia de una oferta.
create or replace function private.offer_ttl()
returns interval language sql immutable set search_path = '' as $$ select interval '3 minutes' $$;

-- Lectura para coordinación: una oferta pendiente cuyo plazo ya pasó se muestra como vencida aunque el reloj aún no la haya marcado.
create view public.order_offers_list with (security_invoker = true) as
  select id, order_id, courier_id, offered_by, offered_at, expires_at, responded_at, reject_reason,
         case when status = 'pendiente' and expires_at <= now() then 'vencida' else status end as status
  from sales.order_offers;
revoke all on public.order_offers_list from public, anon;
grant select on public.order_offers_list to authenticated;

-- Proponer ---------------------------------------------------------------------------------------------------------------

create or replace function public.offer_order_to_courier(p_order uuid, p_courier uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_courier identity.couriers;
  v_id uuid;
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes proponer pedidos a repartidores' using errcode = '42501';
  end if;
  -- Freno contra errores en bucle o abuso: máximo 20 propuestas por minuto y por persona.
  if (select count(*) from sales.order_offers where offered_by = auth.uid() and offered_at > now() - interval '1 minute') >= 20 then
    raise exception 'demasiadas propuestas seguidas: espera un momento' using errcode = '42501';
  end if;

  select * into v_order from sales.orders where id = p_order for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if v_order.status not in ('confirmado', 'preparando', 'listo') then
    raise exception 'solo se propone un pedido confirmado, en preparación o listo' using errcode = '22023';
  end if;
  if v_order.courier_id is not null then
    raise exception 'el pedido ya tiene repartidor' using errcode = '22023';
  end if;

  select * into v_courier from identity.couriers where id = p_courier for update;
  if not found or v_courier.status <> 'activo' then
    raise exception 'repartidor no disponible' using errcode = 'P0002';
  end if;
  if v_courier.user_id is null then
    raise exception 'ese repartidor aún no tiene cuenta: asígnaselo directamente' using errcode = '22023';
  end if;
  if not v_courier.available then
    raise exception 'el repartidor no está disponible ahora' using errcode = '22023';
  end if;
  perform private.assert_courier_fits(v_order, p_courier);

  -- Vence primero lo que ya pasó de plazo, para que no estorbe a los índices únicos.
  update sales.order_offers set status = 'vencida'
   where status = 'pendiente' and expires_at <= now() and (order_id = p_order or courier_id = p_courier);
  if exists (select 1 from sales.order_offers where order_id = p_order and status = 'pendiente') then
    raise exception 'este pedido ya tiene una propuesta abierta' using errcode = '23505';
  end if;
  if exists (select 1 from sales.order_offers where courier_id = p_courier and status = 'pendiente') then
    raise exception 'el repartidor ya tiene una propuesta abierta' using errcode = '23505';
  end if;

  insert into sales.order_offers (order_id, courier_id, offered_by, expires_at)
  values (p_order, p_courier, auth.uid(), now() + private.offer_ttl())
  returning id into v_id;
  perform private.write_audit('order.offer_created', 'order', p_order::text, null,
    jsonb_build_object('offer_id', v_id, 'courier_id', p_courier, 'delivery_class', v_order.delivery_class));
  return v_id;
end $$;

create or replace function public.cancel_order_offer(p_offer uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v sales.order_offers;
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes retirar propuestas' using errcode = '42501';
  end if;
  select * into v from sales.order_offers where id = p_offer for update;
  if not found then
    raise exception 'propuesta no encontrada' using errcode = 'P0002';
  end if;
  if v.status <> 'pendiente' or v.expires_at <= now() then
    raise exception 'esa propuesta ya no está abierta' using errcode = '22023';
  end if;
  update sales.order_offers set status = 'cancelada', responded_at = now() where id = p_offer;
  perform private.write_audit('order.offer_cancelled', 'order', v.order_id::text, null,
    jsonb_build_object('offer_id', p_offer, 'courier_id', v.courier_id));
end $$;

-- Repartidores a los que se puede proponer un pedido (coordinación) -------------------------------------------------------

create or replace function public.offerable_couriers(p_order uuid)
returns table (courier_id uuid, full_name text, vehicle_class text, department text, active_orders int)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_order sales.orders;
  c identity.couriers;
begin
  if not private.is_coordination_console() then
    raise exception 'no puedes ver a los repartidores' using errcode = '42501';
  end if;
  select * into v_order from sales.orders where id = p_order;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  for c in
    select * from identity.couriers x
     where x.status = 'activo' and x.user_id is not null and x.available
       and not exists (select 1 from sales.order_offers f where f.courier_id = x.id and f.status = 'pendiente' and f.expires_at > now())
     order by x.available_since, x.full_name
  loop
    begin
      perform private.assert_courier_fits(v_order, c.id);
    exception when others then
      continue;
    end;
    courier_id := c.id;
    full_name := c.full_name;
    vehicle_class := c.vehicle_class;
    department := c.department;
    active_orders := (select count(*)::int from sales.orders o
                       where o.courier_id = c.id and o.status in ('confirmado', 'preparando', 'listo', 'en_camino'));
    return next;
  end loop;
end $$;

-- Lado del repartidor ----------------------------------------------------------------------------------------------------

-- Su propuesta abierta, con lo mínimo para decidir: de dónde sale, hacia qué departamento, cuánto se le paga y si cobra.
-- Nunca lleva la dirección ni el teléfono del cliente: esos llegan cuando el pedido ya es suyo.
create or replace function public.courier_offers()
returns table (
  offer_id uuid, order_id uuid, number bigint, delivery_class text,
  store_name text, store_address text, destination_department text, distance_km numeric,
  courier_pay numeric, payment_method text, cash_total numeric, item_count bigint,
  offered_at timestamptz, expires_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
declare v_courier uuid := private.current_courier_id();
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa ve sus propuestas' using errcode = '42501';
  end if;
  return query
    select f.id, o.id, o.number, o.delivery_class,
           o.store_name, s.address, o.destination_department, o.delivery_distance_km,
           o.courier_pay, o.payment_method,
           case when o.payment_method = 'efectivo' then o.total end,
           (select coalesce(sum(i.quantity), 0) from sales.order_items i where i.order_id = o.id),
           f.offered_at, f.expires_at
      from sales.order_offers f
      join sales.orders o on o.id = f.order_id
      join commerce.stores s on s.id = o.store_id
     where f.courier_id = v_courier and f.status = 'pendiente' and f.expires_at > now() and o.courier_id is null;
end $$;

-- Devuelve el resultado en vez de lanzar un error para los casos que deben quedar guardados: 'aceptada', 'vencida' (el plazo
-- pasó) o 'no_disponible' (el pedido ya tiene otro repartidor, se cayó, o dejó de ser compatible con este repartidor).
-- Un error deshace lo que la función hubiera guardado; por eso solo se lanza para lo que no es del repartidor.
create or replace function public.courier_accept_offer(p_offer uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v sales.order_offers;
  v_order sales.orders;
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa acepta propuestas' using errcode = '42501';
  end if;
  select * into v from sales.order_offers where id = p_offer and courier_id = v_courier for update;
  if not found then
    raise exception 'propuesta no encontrada' using errcode = 'P0002';
  end if;
  -- Idempotente: aceptar dos veces (por mala señal) no asigna dos veces.
  if v.status = 'aceptada' then
    return 'aceptada';
  end if;
  if v.status = 'pendiente' and v.expires_at <= now() then
    update sales.order_offers set status = 'vencida' where id = p_offer;
    perform private.write_audit('order.offer_expired', 'order', v.order_id::text, null,
      jsonb_build_object('offer_id', p_offer, 'courier_id', v_courier));
    return 'vencida';
  end if;
  if v.status = 'vencida' then
    return 'vencida';
  end if;
  if v.status <> 'pendiente' then
    return 'no_disponible';
  end if;

  select * into v_order from sales.orders where id = v.order_id for update;
  if v_order.courier_id is not null or v_order.status not in ('confirmado', 'preparando', 'listo') then
    update sales.order_offers set status = 'cancelada', responded_at = now() where id = p_offer;
    return 'no_disponible';
  end if;
  -- La clase o el departamento pudieron cambiar desde que se propuso.
  begin
    perform private.assert_courier_fits(v_order, v_courier);
  exception when others then
    update sales.order_offers set status = 'cancelada', responded_at = now() where id = p_offer;
    return 'no_disponible';
  end;

  update sales.order_offers set status = 'aceptada', responded_at = now() where id = p_offer;
  update sales.orders set courier_id = v_courier, updated_at = now() where id = v.order_id;
  perform private.write_audit('order.offer_accepted', 'order', v.order_id::text, null,
    jsonb_build_object('offer_id', p_offer, 'courier_id', v_courier));
  perform private.write_audit('order.courier_assigned', 'order', v.order_id::text, null,
    jsonb_build_object('courier_id', v_courier, 'delivery_class', v_order.delivery_class, 'via', 'oferta'));
  return 'aceptada';
end $$;

create or replace function public.courier_reject_offer(p_offer uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v sales.order_offers;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa rechaza propuestas' using errcode = '42501';
  end if;
  if v_reason is not null and char_length(v_reason) not between 5 and 200 then
    raise exception 'el motivo debe tener entre 5 y 200 caracteres' using errcode = '22023';
  end if;
  select * into v from sales.order_offers where id = p_offer and courier_id = v_courier for update;
  if not found then
    raise exception 'propuesta no encontrada' using errcode = 'P0002';
  end if;
  if v.status = 'rechazada' then
    return;
  end if;
  if v.status <> 'pendiente' or v.expires_at <= now() then
    raise exception 'la propuesta ya no está abierta' using errcode = '22023';
  end if;
  update sales.order_offers set status = 'rechazada', responded_at = now(), reject_reason = v_reason where id = p_offer;
  perform private.write_audit('order.offer_rejected', 'order', v.order_id::text, null,
    jsonb_build_object('offer_id', p_offer, 'courier_id', v_courier), v_reason);
end $$;

-- Vencimiento y cancelaciones automáticas -----------------------------------------------------------------------------------

create or replace function private.expire_stale_offers()
returns int language plpgsql security definer set search_path = '' as $$
declare
  r sales.order_offers;
  v_count int := 0;
begin
  for r in
    select * from sales.order_offers where status = 'pendiente' and expires_at <= now() order by expires_at for update skip locked
  loop
    update sales.order_offers set status = 'vencida' where id = r.id;
    perform private.write_audit('order.offer_expired', 'order', r.order_id::text, null,
      jsonb_build_object('offer_id', r.id, 'courier_id', r.courier_id));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function private.expire_stale_offers() from public, anon, authenticated;
select cron.schedule('expire-stale-offers', '* * * * *', $$select private.expire_stale_offers()$$);

-- Si el pedido recibe repartidor por otra vía o termina, sus propuestas abiertas ya no tienen sentido.
create or replace function private.cancel_offers_of_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update sales.order_offers set status = 'cancelada', responded_at = now()
   where order_id = new.id and status = 'pendiente';
  return null;
end $$;
revoke all on function private.cancel_offers_of_order() from public, anon, authenticated;
create trigger cancel_offers_on_order_change
  after update of courier_id, status on sales.orders
  for each row when (
    (new.courier_id is not null and new.courier_id is distinct from old.courier_id)
    or (new.status in ('cancelado', 'rechazado', 'entregado') and new.status is distinct from old.status))
  execute function private.cancel_offers_of_order();

-- Si el repartidor pierde la ficha o la cuenta, se retira lo que tenía pendiente.
create or replace function private.cancel_offers_of_courier()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update sales.order_offers set status = 'cancelada', responded_at = now()
   where courier_id = new.id and status = 'pendiente';
  return null;
end $$;
revoke all on function private.cancel_offers_of_courier() from public, anon, authenticated;
create trigger cancel_offers_on_courier_change
  after update of status, user_id on identity.couriers
  for each row when (
    (new.status = 'inactivo' and old.status is distinct from new.status)
    or (new.user_id is null and old.user_id is not null))
  execute function private.cancel_offers_of_courier();

revoke all on function
  public.offer_order_to_courier(uuid, uuid), public.cancel_order_offer(uuid), public.offerable_couriers(uuid),
  public.courier_offers(), public.courier_accept_offer(uuid), public.courier_reject_offer(uuid, text)
from public, anon;
grant execute on function
  public.offer_order_to_courier(uuid, uuid), public.cancel_order_offer(uuid), public.offerable_couriers(uuid),
  public.courier_offers(), public.courier_accept_offer(uuid), public.courier_reject_offer(uuid, text)
to authenticated;
