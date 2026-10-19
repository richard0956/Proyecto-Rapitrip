-- Fase 4, etapa 1: lectura pública del catálogo para la tienda web.
-- Hasta aquí `anon` no leía nada. Esta migración abre una puerta estrecha y deliberada: seis funciones de solo lectura,
-- `security definer`, con paginación y topes, que devuelven únicamente lo que es público. Nunca devuelven SKU, existencias
-- exactas, costos internos, teléfonos de contacto ni datos de cuentas. La prueba de guardas (010) lista estas funciones
-- como las únicas permitidas para `anon`.

-- Búsqueda por nombre con trigramas.
create extension if not exists pg_trgm with schema extensions;

create index products_name_trgm_idx on commerce.products
  using gin (name extensions.gin_trgm_ops) where status = 'publicado';

-- ¿La tienda es pública? Activa y de un comercio activo. Una tienda cerrada por horario o cierre temporal SÍ es pública:
-- se ve el catálogo y no se puede pedir (decisión D6).
create or replace function private.store_is_public(p_store commerce.stores)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_store.status = 'activa'
     and exists (select 1 from identity.commerces c where c.id = p_store.commerce_id and c.status = 'activo');
$$;

-- ¿Se puede comprar esta variante ahora? Activa y, si lleva control de stock, con al menos una unidad.
create or replace function private.variant_available(p_variant uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from commerce.product_variants v
    left join commerce.inventory i on i.variant_id = v.id
    where v.id = p_variant and v.status = 'activa'
      and (i.variant_id is null or not i.track_stock or i.quantity > 0));
$$;

-- Máximo comprable de una variante: el menor entre las existencias y 99. Nulo si no hay control de stock.
create or replace function private.variant_max_per_order(p_variant uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case when i.variant_id is not null and i.track_stock then least(i.quantity, 99) end
  from commerce.product_variants v
  left join commerce.inventory i on i.variant_id = v.id
  where v.id = p_variant;
$$;

-- ¿Tiene el producto al menos una variante comprable? Los listados ocultan los agotados (decisión D9).
create or replace function private.product_available(p_product uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from commerce.product_variants v where v.product_id = p_product and private.variant_available(v.id));
$$;

-- Escapa los comodines de LIKE para que el texto buscado se tome literal.
create or replace function private.like_escape(p_text text)
returns text language sql immutable set search_path = '' as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- Tiendas ------------------------------------------------------------------------------------------------------------

create or replace function public.catalog_stores(
  p_open_only boolean default false, p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, name text, address text, delivery_fee numeric, open_now boolean,
  closed_until timestamptz, closed_reason text, product_count int
) language sql stable security definer set search_path = '' as $$
  select s.id, s.name, s.address, s.delivery_fee, o.open_now,
         case when s.closed_until > now() then s.closed_until end,
         case when s.closed_until > now() then s.closed_reason end,
         (select count(*)::int from commerce.products p
           where p.store_id = s.id and p.status = 'publicado' and private.product_available(p.id))
  from commerce.stores s
  cross join lateral (select private.store_open_at(s) as open_now) o
  where private.store_is_public(s) and (not coalesce(p_open_only, false) or o.open_now)
  order by o.open_now desc, lower(s.name), s.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Una tienda con su horario semanal. Nulo si no existe o no es pública.
create or replace function public.catalog_store(p_store uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'address', s.address,
    'delivery_fee', s.delivery_fee,
    'open_now', private.store_open_at(s),
    'closed_until', case when s.closed_until > now() then s.closed_until end,
    'closed_reason', case when s.closed_until > now() then s.closed_reason end,
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object(
               'weekday', h.weekday, 'opens', to_char(h.opens, 'HH24:MI'), 'closes', to_char(h.closes, 'HH24:MI'))
             order by h.weekday, h.opens)
      from commerce.store_hours h where h.store_id = s.id), '[]'::jsonb))
  from commerce.stores s
  where s.id = p_store and private.store_is_public(s);
$$;

-- Categorías ---------------------------------------------------------------------------------------------------------

-- Categorías activas con al menos un producto visible, de una tienda o de todas.
create or replace function public.catalog_categories(p_store uuid default null)
returns table (id uuid, name text, product_count int)
language sql stable security definer set search_path = '' as $$
  select m.id, m.name, count(*)::int
  from commerce.master_items m
  join commerce.products p on p.category_id = m.id
  join commerce.stores s on s.id = p.store_id
  where m.kind = 'categoria' and m.status = 'activo'
    and p.status = 'publicado' and private.store_is_public(s)
    and (p_store is null or p.store_id = p_store)
    and private.product_available(p.id)
  group by m.id, m.name
  order by lower(m.name), m.id
  limit 100;
$$;

-- Productos ----------------------------------------------------------------------------------------------------------

create or replace function public.catalog_products(
  p_store uuid default null, p_category uuid default null, p_query text default null,
  p_limit int default 24, p_offset int default 0
) returns table (
  id uuid, store_id uuid, store_name text, name text, category_id uuid, category_name text,
  min_price numeric, cover_path text
) language sql stable security definer set search_path = '' as $$
  select p.id, p.store_id, s.name, p.name, p.category_id, m.name,
         (select min(v.price) from commerce.product_variants v
           where v.product_id = p.id and private.variant_available(v.id)),
         (select i.path from commerce.product_images i where i.product_id = p.id order by i.position, i.id limit 1)
  from commerce.products p
  join commerce.stores s on s.id = p.store_id
  left join commerce.master_items m on m.id = p.category_id and m.status = 'activo'
  where p.status = 'publicado' and private.store_is_public(s)
    and (p_store is null or p.store_id = p_store)
    and (p_category is null or p.category_id = p_category)
    and (nullif(btrim(p_query), '') is null
         or p.name ilike '%' || private.like_escape(left(btrim(p_query), 80)) || '%' escape '\')
    and private.product_available(p.id)
  order by lower(p.name), p.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Un producto con sus imágenes y variantes. Las variantes agotadas se listan marcadas como no disponibles (D9).
-- Nunca incluye SKU ni existencias exactas. Nulo si el producto no es público.
create or replace function public.catalog_product(p_product uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'category_id', p.category_id,
    'category_name', m.name,
    'store', jsonb_build_object(
      'id', s.id, 'name', s.name, 'delivery_fee', s.delivery_fee, 'open_now', private.store_open_at(s),
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
  left join commerce.master_items m on m.id = p.category_id and m.status = 'activo'
  where p.id = p_product and p.status = 'publicado' and private.store_is_public(s)
    and exists (select 1 from commerce.product_variants v where v.product_id = p.id and v.status = 'activa');
$$;

-- Cotizar un carrito ---------------------------------------------------------------------------------------------------

-- p_items: [{"variant_id": uuid, "quantity": 1..99, "seen_price": numeric (opcional)}]. `seen_price` solo sirve para avisar
-- que el precio cambió; el cobro siempre usa el precio vigente que decide `create_order`.
-- Devuelve las líneas con precios y disponibilidad de AHORA, los totales y la lista de problemas con un código estable:
--   tienda_no_disponible, tienda_cerrada, producto_no_disponible, sin_stock, precio_cambiado, cantidad_invalida.
create or replace function public.quote_cart(p_store uuid, p_items jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_store commerce.stores;
  v_open boolean;
  v_row record;
  v_var record;
  v_lines jsonb := '[]'::jsonb;
  v_problems jsonb := '[]'::jsonb;
  v_subtotal numeric(12, 2) := 0;
  v_max int;
  v_qty int;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 30 then
    raise exception 'el carrito debe tener entre 1 y 30 productos' using errcode = '22023';
  end if;

  select * into v_store from commerce.stores where id = p_store;
  if not found or not private.store_is_public(v_store) then
    return jsonb_build_object(
      'store', null, 'lines', '[]'::jsonb, 'subtotal', 0, 'delivery_fee', 0, 'total', 0,
      'problems', jsonb_build_array(jsonb_build_object('code', 'tienda_no_disponible')));
  end if;
  v_open := private.store_open_at(v_store);
  if not v_open then
    v_problems := v_problems || jsonb_build_object('code', 'tienda_cerrada');
  end if;

  -- Un renglón por variante: las repetidas se suman, igual que en create_order.
  for v_row in
    select e ->> 'variant_id' as vid, sum(coalesce((e ->> 'quantity')::int, 0))::int as qty,
           max((e ->> 'seen_price')::numeric) as seen_price
    from jsonb_array_elements(p_items) e
    where (e ->> 'variant_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    group by 1
    order by 1
  loop
    v_qty := v_row.qty;
    if v_qty < 1 or v_qty > 99 then
      v_problems := v_problems || jsonb_build_object('code', 'cantidad_invalida', 'variant_id', v_row.vid);
      continue;
    end if;

    select v.id, v.name as variant_name, v.price, p.id as product_id, p.name as product_name,
           (select i.path from commerce.product_images i where i.product_id = p.id order by i.position, i.id limit 1) as cover
      into v_var
      from commerce.product_variants v
      join commerce.products p on p.id = v.product_id
     where v.id = v_row.vid::uuid and v.store_id = p_store and v.status = 'activa' and p.status = 'publicado';
    if not found then
      v_problems := v_problems || jsonb_build_object('code', 'producto_no_disponible', 'variant_id', v_row.vid);
      continue;
    end if;

    v_max := private.variant_max_per_order(v_var.id);
    if v_max is not null and v_max < v_qty then
      v_problems := v_problems || jsonb_build_object(
        'code', 'sin_stock', 'variant_id', v_var.id, 'product_name', v_var.product_name, 'max_per_order', v_max);
      -- La línea se conserva con la cantidad pedida: el cliente decide si la baja o la quita.
    end if;
    if v_row.seen_price is not null and v_row.seen_price <> v_var.price then
      v_problems := v_problems || jsonb_build_object(
        'code', 'precio_cambiado', 'variant_id', v_var.id, 'product_name', v_var.product_name,
        'old_price', v_row.seen_price, 'new_price', v_var.price);
    end if;

    v_lines := v_lines || jsonb_build_object(
      'variant_id', v_var.id, 'product_id', v_var.product_id, 'product_name', v_var.product_name,
      'variant_name', v_var.variant_name, 'cover_path', v_var.cover, 'unit_price', v_var.price,
      'quantity', v_qty, 'line_total', v_var.price * v_qty,
      'available', private.variant_available(v_var.id), 'max_per_order', v_max);
    v_subtotal := v_subtotal + v_var.price * v_qty;
  end loop;

  return jsonb_build_object(
    'store', jsonb_build_object('id', v_store.id, 'name', v_store.name, 'open_now', v_open),
    'lines', v_lines,
    'subtotal', v_subtotal,
    'delivery_fee', v_store.delivery_fee,
    'total', v_subtotal + v_store.delivery_fee,
    'problems', v_problems);
end $$;

-- Permisos: solo estas funciones son públicas; los ayudantes de `private` no se exponen.
revoke all on function
  public.catalog_stores(boolean, int, int), public.catalog_store(uuid), public.catalog_categories(uuid),
  public.catalog_products(uuid, uuid, text, int, int), public.catalog_product(uuid), public.quote_cart(uuid, jsonb)
from public, anon, authenticated;
grant execute on function
  public.catalog_stores(boolean, int, int), public.catalog_store(uuid), public.catalog_categories(uuid),
  public.catalog_products(uuid, uuid, text, int, int), public.catalog_product(uuid), public.quote_cart(uuid, jsonb)
to anon, authenticated;
