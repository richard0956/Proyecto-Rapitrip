-- Descuentos de productos.
--
-- Cuando el comercio baja el precio de una variante al menos un 5 % respecto de su precio de lista, la variante queda en descuento:
-- el precio anterior se guarda en `compare_at_price` y el porcentaje se calcula (nunca se escribe a mano). El comercio no puede
-- inventar un «precio antes» alto: solo existe el que la variante tuvo de verdad. Si el precio vuelve a subir hasta menos de un
-- 5 % por debajo de su precio de lista, el descuento se quita solo; también se puede quitar a mano. No hay fecha de fin: la
-- administra el comercio.

alter table commerce.product_variants
  add column compare_at_price numeric(12, 2) check (compare_at_price is null or compare_at_price > price);

-- Porcentaje de descuento (0 si no hay).
create or replace function private.discount_pct(p_price numeric, p_compare numeric)
returns int language sql immutable set search_path = '' as $$
  select case when p_compare is null or p_compare <= p_price then 0 else round((p_compare - p_price) / p_compare * 100)::int end;
$$;
grant execute on function private.discount_pct(numeric, numeric) to authenticated, anon;

create or replace function public.update_variant(p_variant uuid, p_name text, p_sku text, p_price numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old commerce.product_variants;
  v_changed text[] := '{}';
  v_new numeric(12, 2) := round(p_price, 2);
  v_list numeric;
  v_compare numeric(12, 2);
begin
  select * into v_old from commerce.product_variants where id = p_variant for update;
  if not found then
    raise exception 'variante no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_store_manager(private.store_commerce(v_old.store_id));
  perform private.validate_variant(p_name, p_sku, p_price);
  if v_old.name is distinct from btrim(p_name) then v_changed := array_append(v_changed, 'name'); end if;
  if v_old.sku is distinct from p_sku then v_changed := array_append(v_changed, 'sku'); end if;
  if v_old.price is distinct from v_new then v_changed := array_append(v_changed, 'price'); end if;

  -- Precio de lista de referencia: el anterior de un descuento vigente o, si no hay, el precio que tenía.
  v_list := coalesce(v_old.compare_at_price, v_old.price);
  v_compare := case when v_new <= v_list * 0.95 then v_list end;
  if v_old.compare_at_price is distinct from v_compare then v_changed := array_append(v_changed, 'discount'); end if;

  begin
    update commerce.product_variants
       set name = btrim(p_name), sku = p_sku, price = v_new, compare_at_price = v_compare, updated_at = now()
     where id = p_variant;
  exception when unique_violation then
    raise exception 'ya existe una variante con ese SKU en la tienda' using errcode = '23505';
  end;
  perform private.write_audit('variant.updated', 'variant', p_variant::text, null,
    jsonb_build_object('changed_fields', to_jsonb(v_changed)));
end $$;

-- Quita el descuento de una variante y deja el precio actual como precio normal.
create or replace function public.remove_variant_discount(p_variant uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old commerce.product_variants;
begin
  select * into v_old from commerce.product_variants where id = p_variant for update;
  if not found then
    raise exception 'variante no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_store_manager(private.store_commerce(v_old.store_id));
  if v_old.compare_at_price is null then
    raise exception 'la variante no tiene descuento' using errcode = '22023';
  end if;
  update commerce.product_variants set compare_at_price = null, updated_at = now() where id = p_variant;
  perform private.write_audit('variant.discount_removed', 'variant', p_variant::text, null,
    jsonb_build_object('was_discount_pct', private.discount_pct(v_old.price, v_old.compare_at_price)));
end $$;

revoke all on function public.remove_variant_discount(uuid) from public, anon, authenticated;
grant execute on function public.remove_variant_discount(uuid) to authenticated;

-- Consola: el editor de variantes ve el precio anterior y el porcentaje.
create or replace view public.product_variants_list with (security_invoker = true) as
  select id, product_id, store_id, name, sku, price, status, compare_at_price, private.discount_pct(price, compare_at_price) as discount_pct
  from commerce.product_variants;

-- Catálogo público --------------------------------------------------------------------------------------------------------
-- La tarjeta muestra el descuento más grande de las presentaciones disponibles y, si la más barata (la del botón rápido) está en
-- descuento, su precio anterior tachado. Nuevo filtro `p_discount_only` y nuevo orden `descuento`.

drop function public.catalog_search_products(uuid, uuid, text, int, int, numeric, numeric, text, text, boolean);

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
  compare_price numeric, discount_pct int
) language sql stable security definer set search_path = '' as $$
  with base as (
    select p.id, p.store_id, s.name as store_name, p.name, p.category_id, m.name as category_name,
           q.id as quick_id, q.name as quick_name, q.price as min_price, private.variant_max_per_order(q.id) as quick_max,
           (select i.path from commerce.product_images i where i.product_id = p.id order by i.position, i.id limit 1) as cover_path,
           (select count(*)::int from commerce.product_variants v where v.product_id = p.id and v.status = 'activa') as variant_count,
           c.kind as commerce_kind, private.store_open_at(s) as store_open, p.created_at, b.name as brand_name,
           q.compare_at_price as compare_price,
           coalesce((select max(private.discount_pct(v.price, v.compare_at_price)) from commerce.product_variants v
                      where v.product_id = p.id and private.variant_available(v.id)), 0) as discount_pct
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
         b.compare_price, b.discount_pct
  from base b
  where (not coalesce(p_open_only, false) or b.store_open)
    and (not coalesce(p_discount_only, false) or b.discount_pct > 0)
  order by
    case when p_sort = 'precio_asc' then b.min_price end asc,
    case when p_sort = 'precio_desc' then b.min_price end desc,
    case when p_sort = 'recientes' then b.created_at end desc,
    case when p_sort = 'descuento' then b.discount_pct end desc,
    lower(b.name), b.id
  limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.catalog_search_products(uuid, uuid, text, int, int, numeric, numeric, text, text, boolean, boolean) from public, anon, authenticated;
grant execute on function public.catalog_search_products(uuid, uuid, text, int, int, numeric, numeric, text, text, boolean, boolean) to anon, authenticated;

-- La ficha del producto: cada presentación trae su precio anterior y su porcentaje.
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
               'compare_at_price', v.compare_at_price,
               'discount_pct', private.discount_pct(v.price, v.compare_at_price),
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
