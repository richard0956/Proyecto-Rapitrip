-- Cifras de los dashboards por rol. Todas son `security invoker`: la seguridad de filas de `sales.orders` decide qué pedidos
-- ve quien llama (el comercio los suyos, coordinación y administración todos), así que ninguna función ensancha el acceso.
-- "Venta" = pedidos confirmados en adelante (igual que `salesStatuses` en la consola). Los días son los de Costa Rica (UTC−6).
-- `p_to` es exclusivo.

-- Quién lee cifras de negocio: coordinación y administración (todo) o el comercio dueño de ese pedido. La RLS de `sales.orders`
-- también deja ver al cliente sus propias compras; ese acceso no debe colarse en las ventas de un comercio que además compra.
create or replace function private.is_business_reader(p_commerce uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_ops_console() or private.has_role('comercio', p_commerce);
$$;
revoke all on function private.is_business_reader(uuid) from public, anon;
grant execute on function private.is_business_reader(uuid) to authenticated;

create or replace function public.sales_by_day(p_from timestamptz, p_to timestamptz, p_store uuid default null)
returns table (day date, orders int, sales numeric)
language sql stable security invoker set search_path = '' as $$
  select (o.created_at at time zone 'America/Costa_Rica')::date as day, count(*)::int, coalesce(sum(o.total), 0)
  from sales.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and private.is_business_reader(o.commerce_id)
    and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado')
    and (p_store is null or o.store_id = p_store)
  group by 1
  order by 1;
$$;

create or replace function public.orders_by_status(p_from timestamptz, p_to timestamptz, p_store uuid default null)
returns table (status text, orders int)
language sql stable security invoker set search_path = '' as $$
  select o.status, count(*)::int
  from sales.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and private.is_business_reader(o.commerce_id)
    and (p_store is null or o.store_id = p_store)
  group by o.status
  order by 2 desc;
$$;

create or replace function public.sales_by_store(p_from timestamptz, p_to timestamptz)
returns table (store_id uuid, store_name text, orders int, sales numeric)
language sql stable security invoker set search_path = '' as $$
  select o.store_id, max(o.store_name), count(*)::int, coalesce(sum(o.total), 0)
  from sales.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and private.is_business_reader(o.commerce_id)
    and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado')
  group by o.store_id
  order by 4 desc;
$$;

create or replace function public.top_products(p_from timestamptz, p_to timestamptz, p_store uuid default null, p_limit int default 5)
returns table (product_name text, units int, sales numeric)
language sql stable security invoker set search_path = '' as $$
  select i.product_name, sum(i.quantity)::int, coalesce(sum(i.line_total), 0)
  from sales.orders o
  join sales.order_items i on i.order_id = o.id
  where o.created_at >= p_from and o.created_at < p_to
    and private.is_business_reader(o.commerce_id)
    and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado')
    and (p_store is null or o.store_id = p_store)
  group by i.product_name
  order by 2 desc, 1
  limit greatest(p_limit, 1);
$$;

-- Lo ya entregado: productos (subtotal) y envíos. Todavía no existe un modelo de comisión, así que no hay "parte ganada".
create or replace function public.delivered_totals(p_from timestamptz, p_to timestamptz, p_store uuid default null)
returns table (orders int, products numeric, delivery_fees numeric)
language sql stable security invoker set search_path = '' as $$
  select count(*)::int, coalesce(sum(o.subtotal), 0), coalesce(sum(o.delivery_fee), 0)
  from sales.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and private.is_business_reader(o.commerce_id)
    and o.status = 'entregado'
    and (p_store is null or o.store_id = p_store);
$$;

-- Minutos promedio entre "preparando" y "listo"; null si ningún pedido del periodo completó ambos pasos.
create or replace function public.avg_prep_minutes(p_from timestamptz, p_to timestamptz, p_store uuid default null)
returns numeric
language sql stable security invoker set search_path = '' as $$
  select round(avg(extract(epoch from (done.at - started.at)) / 60)::numeric, 1)
  from sales.orders o
  cross join lateral (
    select min(e.created_at) as at from sales.order_events e where e.order_id = o.id and e.to_status = 'preparando'
  ) started
  cross join lateral (
    select min(e.created_at) as at from sales.order_events e where e.order_id = o.id and e.to_status = 'listo' and e.created_at > started.at
  ) done
  where o.created_at >= p_from and o.created_at < p_to
    and private.is_business_reader(o.commerce_id)
    and (p_store is null or o.store_id = p_store)
    and started.at is not null and done.at is not null;
$$;

create or replace function public.payments_by_day(p_from timestamptz, p_to timestamptz)
returns table (day date, method text, total numeric)
language sql stable security invoker set search_path = '' as $$
  select (o.created_at at time zone 'America/Costa_Rica')::date, o.payment_method, coalesce(sum(o.total), 0)
  from sales.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and private.is_business_reader(o.commerce_id)
    and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado')
  group by 1, 2
  order by 1, 2;
$$;

-- Pedidos por confirmar cuyo plazo ya venció. Solo coordinación y administración; para cualquier otro rol devuelve 0.
create or replace function public.overdue_confirmations()
returns int
language sql stable security invoker set search_path = '' as $$
  select case when private.is_coordination_console() then
    (select count(*)::int from sales.orders o where o.status = 'por_confirmar' and o.expires_at is not null and o.expires_at < now())
  else 0 end;
$$;

-- Comercios con varios pedidos rechazados en los últimos días. Solo administración; para cualquier otro rol, vacío.
create or replace function public.repeat_rejections(p_days int default 7, p_min int default 3)
returns table (commerce_id uuid, store_name text, rejections int)
language sql stable security invoker set search_path = '' as $$
  select o.commerce_id, max(o.store_name), count(*)::int
  from sales.orders o
  where private.is_admin_console()
    and o.status = 'rechazado'
    and o.updated_at >= now() - make_interval(days => greatest(p_days, 1))
  group by o.commerce_id
  having count(*) >= greatest(p_min, 1)
  order by 3 desc;
$$;

revoke all on function
  public.sales_by_day(timestamptz, timestamptz, uuid), public.orders_by_status(timestamptz, timestamptz, uuid),
  public.sales_by_store(timestamptz, timestamptz), public.top_products(timestamptz, timestamptz, uuid, int),
  public.delivered_totals(timestamptz, timestamptz, uuid), public.avg_prep_minutes(timestamptz, timestamptz, uuid),
  public.payments_by_day(timestamptz, timestamptz), public.overdue_confirmations(), public.repeat_rejections(int, int)
from public, anon;
grant execute on function
  public.sales_by_day(timestamptz, timestamptz, uuid), public.orders_by_status(timestamptz, timestamptz, uuid),
  public.sales_by_store(timestamptz, timestamptz), public.top_products(timestamptz, timestamptz, uuid, int),
  public.delivered_totals(timestamptz, timestamptz, uuid), public.avg_prep_minutes(timestamptz, timestamptz, uuid),
  public.payments_by_day(timestamptz, timestamptz), public.overdue_confirmations(), public.repeat_rejections(int, int)
to authenticated;
