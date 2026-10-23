-- Catálogo con filtros: la lista de productos y la de tiendas aceptan los filtros de la barra del catálogo de la tienda
-- (texto, categoría, tienda, rango de precio, tipo de vendedor, solo abiertas y orden) y devuelven lo necesario para una tarjeta
-- completa (variantes, la variante más barata disponible para «agregar», tipo de comercio, si la tienda está abierta, total).
-- Son funciones nuevas (`catalog_search_stores` y `catalog_search_products`): las anteriores (`catalog_stores`, `catalog_products`)
-- siguen igual, porque cambiar lo que devuelven obligaría a borrarlas y recrearlas.
-- Sigue siendo lectura pública estrecha: nunca devuelve SKU, existencias exactas, RUC ni datos de contacto.

create or replace function public.catalog_search_stores(
  p_open_only boolean default false, p_limit int default 24, p_offset int default 0,
  p_query text default null, p_kind text default null, p_category uuid default null
) returns table (
  id uuid, name text, address text, delivery_fee numeric, open_now boolean,
  closed_until timestamptz, closed_reason text, product_count int, commerce_kind text, categories text[]
) language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.address, s.delivery_fee, o.open_now,
         case when s.closed_until > now() then s.closed_until end,
         case when s.closed_until > now() then s.closed_reason end,
         (select count(*)::int from commerce.products p
           where p.store_id = s.id and p.status = 'publicado' and private.product_available(p.id)),
         c.kind,
         coalesce((select array_agg(x.name order by x.n desc, lower(x.name))
                     from (select m.name, count(*) as n
                             from commerce.products p
                             join commerce.master_items m on m.id = p.category_id and m.status = 'activo'
                            where p.store_id = s.id and p.status = 'publicado' and private.product_available(p.id)
                            group by m.name order by count(*) desc, lower(m.name) limit 3) x), '{}')
  from commerce.stores s
  join identity.commerces c on c.id = s.commerce_id
  cross join lateral (select private.store_open_at(s) as open_now) o
  where private.store_is_public(s)
    and (not coalesce(p_open_only, false) or o.open_now)
    and (p_kind is null or c.kind = p_kind)
    and (nullif(btrim(p_query), '') is null
         or s.name ilike '%' || private.like_escape(left(btrim(p_query), 80)) || '%' escape '\')
    and (p_category is null or exists (
          select 1 from commerce.products p
           where p.store_id = s.id and p.category_id = p_category and p.status = 'publicado' and private.product_available(p.id)))
  order by o.open_now desc, lower(s.name), s.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.catalog_search_products(
  p_store uuid default null, p_category uuid default null, p_query text default null,
  p_limit int default 24, p_offset int default 0,
  p_min_price numeric default null, p_max_price numeric default null, p_sort text default 'nombre',
  p_kind text default null, p_open_only boolean default false
) returns table (
  id uuid, store_id uuid, store_name text, name text, category_id uuid, category_name text,
  min_price numeric, cover_path text,
  variant_count int, quick_variant_id uuid, quick_variant_name text, quick_max int,
  commerce_kind text, store_open boolean, created_at timestamptz, brand_name text, total_count int
) language sql stable security definer set search_path = '' as $$
  with base as (
    select p.id, p.store_id, s.name as store_name, p.name, p.category_id, m.name as category_name,
           q.id as quick_id, q.name as quick_name, q.price as min_price, private.variant_max_per_order(q.id) as quick_max,
           (select i.path from commerce.product_images i where i.product_id = p.id order by i.position, i.id limit 1) as cover_path,
           (select count(*)::int from commerce.product_variants v where v.product_id = p.id and v.status = 'activa') as variant_count,
           c.kind as commerce_kind, private.store_open_at(s) as store_open, p.created_at, b.name as brand_name
    from commerce.products p
    join commerce.stores s on s.id = p.store_id
    join identity.commerces c on c.id = s.commerce_id
    left join commerce.master_items m on m.id = p.category_id and m.status = 'activo'
    left join commerce.master_items b on b.id = p.brand_id and b.status = 'activo'
    cross join lateral (
      select v.id, v.name, v.price from commerce.product_variants v
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
         b.commerce_kind, b.store_open, b.created_at, b.brand_name, (count(*) over ())::int
  from base b
  where not coalesce(p_open_only, false) or b.store_open
  order by
    case when p_sort = 'precio_asc' then b.min_price end asc,
    case when p_sort = 'precio_desc' then b.min_price end desc,
    case when p_sort = 'recientes' then b.created_at end desc,
    lower(b.name), b.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- La ficha del producto muestra el tipo de comercio y la marca.
create or replace function public.catalog_product(p_product uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'category_id', p.category_id,
    'category_name', m.name,
    'brand_name', b.name,
    'store', jsonb_build_object(
      'id', s.id, 'name', s.name, 'delivery_fee', s.delivery_fee, 'open_now', private.store_open_at(s),
      'commerce_kind', c.kind,
      'closed_until', case when s.closed_until > now() then s.closed_until end,
      'closed_reason', case when s.closed_until > now() then s.closed_reason end),
    'images', coalesce((
      select jsonb_agg(i.path order by i.position, i.id) from commerce.product_images i where i.product_id = p.id), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id, 'name', v.name, 'price', v.price,
               'available', private.variant_available(v.id),
               'max_per_order', private.variant_max_per_order(v.id))
             order by v.price, lower(v.name), v.id)
      from commerce.product_variants v where v.product_id = p.id and v.status = 'activa'), '[]'::jsonb))
  from commerce.products p
  join commerce.stores s on s.id = p.store_id
  join identity.commerces c on c.id = s.commerce_id
  left join commerce.master_items m on m.id = p.category_id and m.status = 'activo'
  left join commerce.master_items b on b.id = p.brand_id and b.status = 'activo'
  where p.id = p_product and p.status = 'publicado' and private.store_is_public(s)
    and exists (select 1 from commerce.product_variants v where v.product_id = p.id and v.status = 'activa');
$$;

revoke all on function
  public.catalog_search_stores(boolean, int, int, text, text, uuid),
  public.catalog_search_products(uuid, uuid, text, int, int, numeric, numeric, text, text, boolean)
from public, anon, authenticated;
grant execute on function
  public.catalog_search_stores(boolean, int, int, text, text, uuid),
  public.catalog_search_products(uuid, uuid, text, int, int, numeric, numeric, text, text, boolean)
to anon, authenticated;
