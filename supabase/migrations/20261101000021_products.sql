-- Fase 2, etapa 4: productos por tienda, variantes (precio y SKU) e imágenes.
-- Un producto pertenece a una tienda. Se publica solo si tiene al menos una variante activa; el catálogo maestro es opcional.
-- Imágenes: hasta 5 por producto (JPEG, PNG o WebP, máximo 2 MB), en el bucket público `product-images`
-- bajo la ruta <tienda>/<producto>/<archivo>. La primera es la portada.

create table commerce.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references commerce.stores(id),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 1000),
  category_id uuid references commerce.master_items(id),
  brand_id uuid references commerce.master_items(id),
  product_type_id uuid references commerce.master_items(id),
  status text not null default 'borrador' check (status in ('borrador', 'publicado', 'archivado')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_store_idx on commerce.products (store_id, status);
create unique index products_unique_name_per_store on commerce.products (store_id, lower(btrim(name))) where status <> 'archivado';

create table commerce.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references commerce.products(id) on delete cascade,
  store_id uuid not null references commerce.stores(id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  sku text not null check (sku ~ '^[A-Za-z0-9._-]{2,40}$'),
  price numeric(12, 2) not null check (price >= 0 and price < 100000000),
  status text not null default 'activa' check (status in ('activa', 'inactiva')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index product_variants_sku_per_store on commerce.product_variants (store_id, lower(sku));
create index product_variants_product_idx on commerce.product_variants (product_id);

create table commerce.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references commerce.products(id) on delete cascade,
  path text not null unique,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index product_images_product_idx on commerce.product_images (product_id, position);

alter table commerce.products enable row level security;
alter table commerce.product_variants enable row level security;
alter table commerce.product_images enable row level security;

create policy products_select_own on commerce.products
  for select to authenticated using (exists (
    select 1 from commerce.stores s where s.id = products.store_id and private.has_role('comercio', s.commerce_id)));
create policy products_select_admin on commerce.products
  for select to authenticated using (private.is_admin_console());

create policy variants_select_own on commerce.product_variants
  for select to authenticated using (exists (
    select 1 from commerce.stores s where s.id = product_variants.store_id and private.has_role('comercio', s.commerce_id)));
create policy variants_select_admin on commerce.product_variants
  for select to authenticated using (private.is_admin_console());

create policy images_select_own on commerce.product_images
  for select to authenticated using (exists (
    select 1 from commerce.products p join commerce.stores s on s.id = p.store_id
    where p.id = product_images.product_id and private.has_role('comercio', s.commerce_id)));
create policy images_select_admin on commerce.product_images
  for select to authenticated using (private.is_admin_console());

grant select on commerce.products, commerce.product_variants, commerce.product_images to authenticated;

create or replace function private.product_store(p_product uuid)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  select store_id into v from commerce.products where id = p_product;
  if v is null then
    raise exception 'producto no encontrado' using errcode = 'P0002';
  end if;
  return v;
end $$;

-- Referencias al catálogo maestro: opcionales, pero si vienen deben existir, estar activas y ser de la clase correcta.
create or replace function private.validate_master_refs(p_category uuid, p_brand uuid, p_type uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_category is not null and not exists (select 1 from commerce.master_items where id = p_category and kind = 'categoria' and status = 'activo') then
    raise exception 'categoría no disponible' using errcode = '22023';
  end if;
  if p_brand is not null and not exists (select 1 from commerce.master_items where id = p_brand and kind = 'marca' and status = 'activo') then
    raise exception 'marca no disponible' using errcode = '22023';
  end if;
  if p_type is not null and not exists (select 1 from commerce.master_items where id = p_type and kind = 'tipo_producto' and status = 'activo') then
    raise exception 'tipo de producto no disponible' using errcode = '22023';
  end if;
end $$;

create or replace function private.validate_product(p_name text, p_description text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
    raise exception 'el nombre del producto debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  if p_description is not null and char_length(p_description) > 1000 then
    raise exception 'la descripción admite hasta 1000 caracteres' using errcode = '22023';
  end if;
end $$;

create or replace function public.create_product(
  p_store uuid, p_name text, p_description text default null,
  p_category uuid default null, p_brand uuid default null, p_type uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  perform private.validate_product(p_name, p_description);
  perform private.validate_master_refs(p_category, p_brand, p_type);
  begin
    insert into commerce.products (store_id, name, description, category_id, brand_id, product_type_id, created_by)
    values (p_store, btrim(p_name), nullif(btrim(p_description), ''), p_category, p_brand, p_type, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya existe un producto con ese nombre en la tienda' using errcode = '23505';
  end;
  perform private.write_audit('product.created', 'product', v_id::text, null, jsonb_build_object('store_id', p_store));
  return v_id;
end $$;

create or replace function public.update_product(
  p_product uuid, p_name text, p_description text default null,
  p_category uuid default null, p_brand uuid default null, p_type uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old commerce.products;
  v_changed text[] := '{}';
begin
  perform private.require_store_manager(private.store_commerce(private.product_store(p_product)));
  perform private.validate_product(p_name, p_description);
  perform private.validate_master_refs(p_category, p_brand, p_type);
  select * into v_old from commerce.products where id = p_product for update;
  if v_old.status = 'archivado' then
    raise exception 'un producto archivado no se edita' using errcode = '22023';
  end if;
  if v_old.name is distinct from btrim(p_name) then v_changed := array_append(v_changed, 'name'); end if;
  if v_old.description is distinct from nullif(btrim(p_description), '') then v_changed := array_append(v_changed, 'description'); end if;
  if v_old.category_id is distinct from p_category or v_old.brand_id is distinct from p_brand
     or v_old.product_type_id is distinct from p_type then
    v_changed := array_append(v_changed, 'classification');
  end if;
  begin
    update commerce.products
      set name = btrim(p_name), description = nullif(btrim(p_description), ''), category_id = p_category,
          brand_id = p_brand, product_type_id = p_type, updated_at = now()
      where id = p_product;
  exception when unique_violation then
    raise exception 'ya existe un producto con ese nombre en la tienda' using errcode = '23505';
  end;
  perform private.write_audit('product.updated', 'product', p_product::text, null,
    jsonb_build_object('changed_fields', to_jsonb(v_changed)));
end $$;

-- borrador → publicado (exige una variante activa) → archivado. Un producto archivado no vuelve.
create or replace function public.set_product_status(p_product uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old commerce.products;
begin
  perform private.require_store_manager(private.store_commerce(private.product_store(p_product)));
  if p_status not in ('borrador', 'publicado', 'archivado') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  select * into v_old from commerce.products where id = p_product for update;
  if v_old.status = 'archivado' then
    raise exception 'un producto archivado no cambia de estado' using errcode = '22023';
  end if;
  if p_status = 'publicado' and not exists (
    select 1 from commerce.product_variants where product_id = p_product and status = 'activa') then
    raise exception 'agrega al menos una variante activa antes de publicar' using errcode = '22023';
  end if;
  if p_status = 'archivado' and (p_reason is null or char_length(btrim(p_reason)) < 5) then
    raise exception 'indica el motivo (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  update commerce.products set status = p_status, updated_at = now() where id = p_product;
  perform private.write_audit('product.status_changed', 'product', p_product::text, null,
    jsonb_build_object('status', p_status), p_reason);
end $$;

create or replace function private.validate_variant(p_name text, p_sku text, p_price numeric)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception 'el nombre de la variante debe tener entre 1 y 80 caracteres' using errcode = '22023';
  end if;
  if p_sku is null or p_sku !~ '^[A-Za-z0-9._-]{2,40}$' then
    raise exception 'el SKU admite letras, números, punto, guion y guion bajo (2 a 40 caracteres)' using errcode = '22023';
  end if;
  if p_price is null or p_price < 0 or p_price >= 100000000 then
    raise exception 'el precio debe estar entre 0 y 99 999 999,99' using errcode = '22023';
  end if;
end $$;

create or replace function public.create_variant(p_product uuid, p_name text, p_sku text, p_price numeric)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := private.product_store(p_product);
  v_id uuid;
begin
  perform private.require_store_manager(private.store_commerce(v_store));
  perform private.validate_variant(p_name, p_sku, p_price);
  if exists (select 1 from commerce.products where id = p_product and status = 'archivado') then
    raise exception 'un producto archivado no se edita' using errcode = '22023';
  end if;
  begin
    insert into commerce.product_variants (product_id, store_id, name, sku, price)
    values (p_product, v_store, btrim(p_name), p_sku, round(p_price, 2))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya existe una variante con ese SKU en la tienda' using errcode = '23505';
  end;
  perform private.write_audit('variant.created', 'variant', v_id::text, null, jsonb_build_object('product_id', p_product));
  return v_id;
end $$;

create or replace function public.update_variant(p_variant uuid, p_name text, p_sku text, p_price numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old commerce.product_variants;
  v_changed text[] := '{}';
begin
  select * into v_old from commerce.product_variants where id = p_variant for update;
  if not found then
    raise exception 'variante no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_store_manager(private.store_commerce(v_old.store_id));
  perform private.validate_variant(p_name, p_sku, p_price);
  if v_old.name is distinct from btrim(p_name) then v_changed := array_append(v_changed, 'name'); end if;
  if v_old.sku is distinct from p_sku then v_changed := array_append(v_changed, 'sku'); end if;
  if v_old.price is distinct from round(p_price, 2) then v_changed := array_append(v_changed, 'price'); end if;
  begin
    update commerce.product_variants set name = btrim(p_name), sku = p_sku, price = round(p_price, 2), updated_at = now()
      where id = p_variant;
  exception when unique_violation then
    raise exception 'ya existe una variante con ese SKU en la tienda' using errcode = '23505';
  end;
  perform private.write_audit('variant.updated', 'variant', p_variant::text, null,
    jsonb_build_object('changed_fields', to_jsonb(v_changed)));
end $$;

-- Un producto publicado no puede quedarse sin variantes activas.
create or replace function public.set_variant_status(p_variant uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old commerce.product_variants;
begin
  select * into v_old from commerce.product_variants where id = p_variant for update;
  if not found then
    raise exception 'variante no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_store_manager(private.store_commerce(v_old.store_id));
  if p_status not in ('activa', 'inactiva') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  if p_status = 'inactiva'
     and exists (select 1 from commerce.products where id = v_old.product_id and status = 'publicado')
     and not exists (select 1 from commerce.product_variants where product_id = v_old.product_id and status = 'activa' and id <> p_variant) then
    raise exception 'el producto está publicado: déjalo en borrador antes de desactivar su última variante' using errcode = '22023';
  end if;
  update commerce.product_variants set status = p_status, updated_at = now() where id = p_variant;
  perform private.write_audit('variant.status_changed', 'variant', p_variant::text, null, jsonb_build_object('status', p_status));
end $$;

-- ───────── Imágenes ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ¿Puede esta sesión escribir en la ruta <tienda>/…? La tienda sale del primer segmento.
create or replace function private.can_write_store_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_store uuid;
  v_commerce uuid;
begin
  begin
    v_store := split_part(p_name, '/', 1)::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  select commerce_id into v_commerce from commerce.stores where id = v_store;
  if v_commerce is null then return false; end if;
  if not private.has_strong_session() then return false; end if;
  return private.has_any_role(array['admin', 'superadmin']::identity.app_role[]) or private.has_role('comercio', v_commerce);
end $$;
grant execute on function private.can_write_store_path(text) to authenticated;

create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and private.can_write_store_path(name));
create policy product_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.can_write_store_path(name));

-- Registra una imagen ya subida. La ruta debe ser <tienda>/<producto>/<archivo> de ese producto.
create or replace function public.add_product_image(p_product uuid, p_path text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_store uuid := private.product_store(p_product);
  v_id uuid;
begin
  perform private.require_store_manager(private.store_commerce(v_store));
  if p_path is null or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9._-]{1,100}$'
     or split_part(p_path, '/', 1) <> v_store::text or split_part(p_path, '/', 2) <> p_product::text then
    raise exception 'ruta de imagen inválida' using errcode = '22023';
  end if;
  if (select count(*) from commerce.product_images where product_id = p_product) >= 5 then
    raise exception 'un producto admite hasta 5 imágenes' using errcode = '22023';
  end if;
  insert into commerce.product_images (product_id, path, position)
  values (p_product, p_path, coalesce((select max(position) + 1 from commerce.product_images where product_id = p_product), 0))
  returning id into v_id;
  perform private.write_audit('product.image_added', 'product', p_product::text);
  return v_id;
end $$;

-- Quita el registro y devuelve la ruta para que el cliente borre el archivo del bucket.
create or replace function public.remove_product_image(p_image uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_img commerce.product_images;
begin
  select * into v_img from commerce.product_images where id = p_image for update;
  if not found then
    raise exception 'imagen no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_store_manager(private.store_commerce(private.product_store(v_img.product_id)));
  delete from commerce.product_images where id = p_image;
  perform private.write_audit('product.image_removed', 'product', v_img.product_id::text);
  return v_img.path;
end $$;

-- Vistas
create view public.products_list with (security_invoker = true) as
  select p.id, p.store_id, s.name as store_name, s.commerce_id, p.name, p.description,
         p.category_id, p.brand_id, p.product_type_id, p.status, p.created_at, p.updated_at,
         (select count(*) from commerce.product_variants v where v.product_id = p.id and v.status = 'activa') as active_variants,
         (select min(v.price) from commerce.product_variants v where v.product_id = p.id and v.status = 'activa') as min_price,
         (select i.path from commerce.product_images i where i.product_id = p.id order by i.position limit 1) as cover_path
  from commerce.products p
  join commerce.stores s on s.id = p.store_id;

create view public.product_variants_list with (security_invoker = true) as
  select id, product_id, store_id, name, sku, price, status from commerce.product_variants;

create view public.product_images_list with (security_invoker = true) as
  select id, product_id, path, position from commerce.product_images;

revoke all on function public.create_product(uuid, text, text, uuid, uuid, uuid),
  public.update_product(uuid, text, text, uuid, uuid, uuid),
  public.set_product_status(uuid, text, text),
  public.create_variant(uuid, text, text, numeric),
  public.update_variant(uuid, text, text, numeric),
  public.set_variant_status(uuid, text),
  public.add_product_image(uuid, text),
  public.remove_product_image(uuid)
from public, anon;
grant execute on function public.create_product(uuid, text, text, uuid, uuid, uuid),
  public.update_product(uuid, text, text, uuid, uuid, uuid),
  public.set_product_status(uuid, text, text),
  public.create_variant(uuid, text, text, numeric),
  public.update_variant(uuid, text, text, numeric),
  public.set_variant_status(uuid, text),
  public.add_product_image(uuid, text),
  public.remove_product_image(uuid)
to authenticated;

revoke all on public.products_list, public.product_variants_list, public.product_images_list from public, anon;
grant select on public.products_list, public.product_variants_list, public.product_images_list to authenticated;
