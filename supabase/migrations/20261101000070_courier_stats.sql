-- Estadísticas de repartidores para las consolas de coordinación y administración. Son `security invoker` y se limitan a
-- `private.is_coordination_console()`: cualquier otro rol (comercio, cliente, cajero) recibe vacío. `p_to` es exclusivo.
--
-- Los kilómetros son los de la ruta tienda → cliente que se midió al cobrar el envío de cada pedido entregado; no son el
-- recorrido real del repartidor (hasta que exista su aplicación con ubicación). Sirven de base para medir la actividad.

-- Una fila por repartidor con pedidos asignados:
--  · deliveries / km / avg_minutes: pedidos entregados en el periodo (el tiempo va de «en camino» a «entregado»).
--  · active_orders: pedidos asignados que todavía no se entregan ni se caen (sin límite de fecha).
--  · cash_pending / cash_pending_orders: efectivo cobrado al entregar que caja aún no recibió (sin límite de fecha).
create or replace function public.courier_stats(p_from timestamptz, p_to timestamptz)
returns table (courier_id uuid, deliveries int, km numeric, avg_minutes numeric, active_orders int, cash_pending numeric, cash_pending_orders int)
language sql stable security invoker set search_path = '' as $$
  select o.courier_id,
         count(*) filter (where in_range)::int,
         coalesce(sum(o.delivery_distance_km) filter (where in_range), 0),
         round((avg(extract(epoch from (o.delivered_at - ev.at)) / 60) filter (where in_range and ev.at is not null))::numeric, 1),
         count(*) filter (where o.status in ('confirmado', 'preparando', 'listo', 'en_camino'))::int,
         coalesce(sum(o.total) filter (where owes_cash), 0),
         count(*) filter (where owes_cash)::int
  from sales.orders o
  left join lateral (
    select min(e.created_at) as at from sales.order_events e where e.order_id = o.id and e.to_status = 'en_camino'
  ) ev on true
  cross join lateral (
    select o.status = 'entregado' and o.delivered_at >= p_from and o.delivered_at < p_to as in_range,
           o.status = 'entregado' and o.payment_method = 'efectivo' and o.cash_received_at is null as owes_cash
  ) f
  where private.is_coordination_console() and o.courier_id is not null and o.channel = 'web'
  group by o.courier_id;
$$;

-- Entregas y kilómetros de un repartidor por día (hora de Costa Rica), para su gráfico.
create or replace function public.courier_daily(p_courier uuid, p_from timestamptz, p_to timestamptz)
returns table (day date, deliveries int, km numeric)
language sql stable security invoker set search_path = '' as $$
  select (o.delivered_at at time zone 'America/Costa_Rica')::date, count(*)::int, coalesce(sum(o.delivery_distance_km), 0)
  from sales.orders o
  where private.is_coordination_console()
    and o.courier_id = p_courier and o.channel = 'web' and o.status = 'entregado'
    and o.delivered_at >= p_from and o.delivered_at < p_to
  group by 1
  order by 1;
$$;

revoke all on function public.courier_stats(timestamptz, timestamptz), public.courier_daily(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.courier_stats(timestamptz, timestamptz), public.courier_daily(uuid, timestamptz, timestamptz) to authenticated;
