-- Unidades e importe vendidos por producto, para el catálogo maestro de administración. Solo administración: para cualquier otro
-- rol devuelve vacío. "Venta" = pedidos confirmados en adelante (igual que las demás cifras de los dashboards); el importe es el
-- de las líneas de producto, sin el envío. `p_to` es exclusivo.
create or replace function public.product_sales(p_from timestamptz, p_to timestamptz)
returns table (product_id uuid, units int, sales numeric)
language sql stable security invoker set search_path = '' as $$
  select v.product_id, sum(i.quantity)::int, coalesce(sum(i.line_total), 0)
  from sales.orders o
  join sales.order_items i on i.order_id = o.id
  join commerce.product_variants v on v.id = i.variant_id
  where private.is_admin_console()
    and o.created_at >= p_from and o.created_at < p_to
    and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado')
  group by v.product_id
  order by 2 desc;
$$;

revoke all on function public.product_sales(timestamptz, timestamptz) from public, anon;
grant execute on function public.product_sales(timestamptz, timestamptz) to authenticated;
