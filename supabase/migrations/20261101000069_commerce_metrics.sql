-- Métricas de producto y de tienda para la consola del comercio (y la administración). Todas son `security invoker` y filtran con
-- `private.is_business_reader`: un comercio solo ve lo suyo, administración y coordinación ven todo, cualquier otro rol (incluido un
-- cliente que mira sus propias compras) recibe vacío. "Venta" = pedidos confirmados en adelante; `p_to` es exclusivo.

-- Una fila por producto con ventas, pedidos en los que estuvo, unidades apartadas y unidades de pedidos caídos.
--  · units / orders / sales: pedidos de venta creados en el periodo (el importe es el de las líneas, sin envío).
--  · reserved_units: lo que hoy está comprometido en pedidos sin entregar ni cancelar (sin límite de fecha).
--  · cancelled_units: unidades de pedidos cancelados o rechazados creados en el periodo.
create or replace function public.product_stats(p_from timestamptz, p_to timestamptz, p_store uuid default null)
returns table (product_id uuid, units int, orders int, sales numeric, reserved_units int, cancelled_units int)
language sql stable security invoker set search_path = '' as $$
  select v.product_id,
         coalesce(sum(i.quantity) filter (where in_range and sold), 0)::int,
         count(distinct o.id) filter (where in_range and sold)::int,
         coalesce(sum(i.line_total) filter (where in_range and sold), 0),
         coalesce(sum(i.quantity) filter (where o.status not in ('entregado', 'cancelado', 'rechazado')), 0)::int,
         coalesce(sum(i.quantity) filter (where in_range and o.status in ('cancelado', 'rechazado')), 0)::int
  from sales.orders o
  join sales.order_items i on i.order_id = o.id
  join commerce.product_variants v on v.id = i.variant_id
  cross join lateral (select o.created_at >= p_from and o.created_at < p_to as in_range,
                             o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado') as sold) f
  where private.is_business_reader(o.commerce_id)
    and (p_store is null or o.store_id = p_store)
  group by v.product_id;
$$;

-- Unidades y pedidos de un producto por día (hora de Costa Rica), para su gráfico de flujo.
create or replace function public.product_daily(p_product uuid, p_from timestamptz, p_to timestamptz)
returns table (day date, units int, orders int)
language sql stable security invoker set search_path = '' as $$
  select (o.created_at at time zone 'America/Costa_Rica')::date, sum(i.quantity)::int, count(distinct o.id)::int
  from sales.orders o
  join sales.order_items i on i.order_id = o.id
  join commerce.product_variants v on v.id = i.variant_id
  where v.product_id = p_product
    and private.is_business_reader(o.commerce_id)
    and o.created_at >= p_from and o.created_at < p_to
    and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado')
  group by 1
  order by 1;
$$;

-- Los productos estrella de cada tienda: los `p_per_store` con más unidades vendidas en el periodo.
create or replace function public.store_top_products(p_from timestamptz, p_to timestamptz, p_per_store int default 3)
returns table (store_id uuid, product_name text, units int, sales numeric, rank int)
language sql stable security invoker set search_path = '' as $$
  select r.store_id, r.product_name, r.units, r.sales, r.rank
  from (
    select o.store_id, max(i.product_name) as product_name, sum(i.quantity)::int as units, coalesce(sum(i.line_total), 0) as sales,
           row_number() over (partition by o.store_id order by sum(i.quantity) desc, max(i.product_name))::int as rank
    from sales.orders o
    join sales.order_items i on i.order_id = o.id
    join commerce.product_variants v on v.id = i.variant_id
    where private.is_business_reader(o.commerce_id)
      and o.created_at >= p_from and o.created_at < p_to
      and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado')
    group by o.store_id, v.product_id
  ) r
  where r.rank <= greatest(p_per_store, 1)
  order by r.store_id, r.rank;
$$;

revoke all on function public.product_stats(timestamptz, timestamptz, uuid), public.product_daily(uuid, timestamptz, timestamptz), public.store_top_products(timestamptz, timestamptz, int) from public, anon;
grant execute on function public.product_stats(timestamptz, timestamptz, uuid), public.product_daily(uuid, timestamptz, timestamptz), public.store_top_products(timestamptz, timestamptz, int) to authenticated;
