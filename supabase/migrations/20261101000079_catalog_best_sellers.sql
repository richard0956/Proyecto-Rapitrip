-- Catálogo público: «Más vendidos» -------------------------------------------------------------------------------------------
-- Nuevo orden `vendidos` y nueva columna `sold_units`: unidades vendidas del producto en los últimos 30 días (pedidos confirmados
-- en adelante, como `product_sales`). Solo se calcula cuando se pide ese orden; con cualquier otro vale 0. La portada usa
-- `sold_units > 0` para no presentar como «más vendido» un producto sin ventas.

drop function public.catalog_search_products(uuid, uuid, text, int, int, numeric, numeric, text, text, boolean, boolean);

create or replace function public.catalog_search_products(
  p_store uuid default null, p_category uuid default null, p_query text default null,
  p_limit int default 24, p_offset int default 0,
  p_min_price numeric default null, p_max_price numeric default null, p_sort text default 'nombre',
  p_kind text default null, p_open_only boolean default false, p_discount_only boolean default false
) returns table (
  id uuid, store_id uuid, store_name text, name text, category_id uuid, category_name text,
  min_price numeric, cover_path text,
  variant_count int, quick_variant_id uuid, quick_variant_name text, quick_max int,
  commerce_kind text, store_open boolean, created_at timestamptz, brand_name text, total_count int,
  compare_price numeric, discount_pct int, sold_units int
) language sql stable security definer set search_path = '' as $$
  with base as (
    select p.id, p.store_id, s.name as store_name, p.name, p.category_id, m.name as category_name,
           q.id as quick_id, q.name as quick_name, q.price as min_price, private.variant_max_per_order(q.id) as quick_max,
           (select i.path from commerce.product_images i where i.product_id = p.id order by i.position, i.id limit 1) as cover_path,
           (select count(*)::int from commerce.product_variants v where v.product_id = p.id and v.status = 'activa') as variant_count,
           c.kind as commerce_kind, private.store_open_at(s) as store_open, p.created_at, b.name as brand_name,
           q.compare_at_price as compare_price,
           coalesce((select max(private.discount_pct(v.price, v.compare_at_price)) from commerce.product_variants v
                      where v.product_id = p.id and private.variant_available(v.id)), 0) as discount_pct,
           case when p_sort = 'vendidos' then
             coalesce((select sum(i.quantity)::int
                         from sales.order_items i
                         join sales.orders o on o.id = i.order_id
                         join commerce.product_variants v on v.id = i.variant_id
                        where v.product_id = p.id
                          and o.created_at >= now() - interval '30 days'
                          and o.status in ('confirmado', 'preparando', 'listo', 'en_camino', 'entregado')), 0)
           else 0 end as sold_units
    from commerce.products p
    join commerce.stores s on s.id = p.store_id
    join identity.commerces c on c.id = s.commerce_id
    left join commerce.master_items m on m.id = p.category_id and m.status = 'activo'
    left join commerce.master_items b on b.id = p.brand_id and b.status = 'activo'
    cross join lateral (
      select v.id, v.name, v.price, v.compare_at_price from commerce.product_variants v
       where v.product_id = p.id and private.variant_available(v.id)
       order by v.price, v.id limit 1) q
    where p.status = 'publicado' and private.store_is_public(s)
      and (p_store is null or p.store_id = p_store)
      and (p_category is null or p.category_id = p_category)
      and (p_kind is null or c.kind = p_kind)
      and (nullif(btrim(p_query), '') is null
           or p.name ilike '%' || private.like_escape(left(btrim(p_query), 80)) || '%' escape '\')
      and (p_min_price is null or q.price >= p_min_price)
      and (p_max_price is null or q.price <= p_max_price)
  )
  select b.id, b.store_id, b.store_name, b.name, b.category_id, b.category_name, b.min_price, b.cover_path,
         b.variant_count, b.quick_id, b.quick_name, b.quick_max,
         b.commerce_kind, b.store_open, b.created_at, b.brand_name, (count(*) over ())::int,
         b.compare_price, b.discount_pct, b.sold_units
  from base b
  where (not coalesce(p_open_only, false) or b.store_open)
    and (not coalesce(p_discount_only, false) or b.discount_pct > 0)
  order by
    case when p_sort = 'precio_asc' then b.min_price end asc,
    case when p_sort = 'precio_desc' then b.min_price end desc,
    case when p_sort = 'recientes' then b.created_at end desc,
    case when p_sort = 'descuento' then b.discount_pct end desc,
    case when p_sort = 'vendidos' then b.sold_units end desc,
    lower(b.name), b.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.catalog_search_products(uuid, uuid, text, int, int, numeric, numeric, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.catalog_search_products(uuid, uuid, text, int, int, numeric, numeric, text, text, boolean, boolean) to anon, authenticated;
