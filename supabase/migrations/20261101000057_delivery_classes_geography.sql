-- Entregas express y programadas, etapa 1 (parte 1): departamentos, elegibilidad del producto y cobertura del repartidor.
-- Diseño: docs/informe/2026-10-21-entregas-express-programado-design.md
--
-- El producto solo dice si PUEDE ser express (tamaño, peso, categoría); la clase final del pedido la decide la cotización
-- según el destino (migración siguiente). Aquí se crean los datos que esa decisión necesita:
--   * departamentos (15 + 2 regiones autónomas) en tiendas, direcciones del cliente y repartidores;
--   * peso, medidas y elegibilidad express del producto, y categorías «solo programado»;
--   * límites de express editables por la administración;
--   * tipo de vehículo controlado (moto | vehiculo) del repartidor.
-- Los datos existentes siguen funcionando: todo producto previo queda elegible y las columnas nuevas admiten nulo.

-- Departamentos --------------------------------------------------------------------------------------------------------
-- `extra_days`: días que se suman al plazo de un envío programado a ese departamento (zonas de acceso lento). Lo fija la operación.

create table sales.departments (
  code text primary key check (code ~ '^[a-z_]{3,20}$'),
  name text not null unique,
  extra_days smallint not null default 0 check (extra_days between 0 and 30)
);
insert into sales.departments (code, name) values
  ('boaco', 'Boaco'), ('carazo', 'Carazo'), ('chinandega', 'Chinandega'), ('chontales', 'Chontales'),
  ('esteli', 'Estelí'), ('granada', 'Granada'), ('jinotega', 'Jinotega'), ('leon', 'León'), ('madriz', 'Madriz'),
  ('managua', 'Managua'), ('masaya', 'Masaya'), ('matagalpa', 'Matagalpa'), ('nueva_segovia', 'Nueva Segovia'),
  ('rio_san_juan', 'Río San Juan'), ('rivas', 'Rivas'),
  ('raccn', 'Costa Caribe Norte'), ('raccs', 'Costa Caribe Sur');

alter table sales.departments enable row level security;
create policy departments_select on sales.departments for select to authenticated using (true);
grant select on sales.departments to authenticated;

-- Tiendas ---------------------------------------------------------------------------------------------------------------

alter table commerce.stores add column department text references sales.departments(code);

create or replace view public.stores_list with (security_invoker = true) as
  select s.id, s.commerce_id, c.name as commerce_name, s.name, s.address, s.contact_phone, s.status,
         s.closed_until, s.closed_reason, s.created_at, s.updated_at,
         private.store_open_at(s) as open_now,
         (select count(*) from commerce.store_hours h where h.store_id = s.id) as hour_ranges,
         s.delivery_fee,
         s.latitude, s.longitude,
         s.department
  from commerce.stores s
  join identity.commerces c on c.id = s.commerce_id;

-- Fija o quita (con nulo) el departamento de una tienda.
create or replace function public.set_store_department(p_store uuid, p_department text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_store_manager(private.store_commerce(p_store));
  if p_department is not null and not exists (select 1 from sales.departments where code = p_department) then
    raise exception 'departamento no válido' using errcode = '22023';
  end if;
  update commerce.stores set department = p_department, updated_at = now() where id = p_store;
  perform private.write_audit('store.department_changed', 'store', p_store::text, null,
    jsonb_build_object('department', p_department));
end $$;

-- Direcciones del cliente -----------------------------------------------------------------------------------------------

alter table sales.customer_addresses add column department text references sales.departments(code);

create or replace view public.my_addresses with (security_invoker = true) as
  select id, label, address, reference, phone, latitude, longitude, is_default, created_at, updated_at, department
  from sales.customer_addresses;

-- Repartidores ----------------------------------------------------------------------------------------------------------
-- `vehicle_type` queda como texto libre de referencia; `vehicle_class` es el valor controlado que usa el despacho.
-- Los repartidores existentes se clasifican por su texto; los que no se reconocen quedan sin clase para que la
-- administración los asigne.

alter table identity.couriers
  add column vehicle_class text check (vehicle_class in ('moto', 'vehiculo')),
  add column department text references sales.departments(code);

-- Clase de vehículo a partir del texto libre de la ficha del repartidor. Reconoce palabras completas (no trozos como «van» dentro
-- de «avanzado») y deja sin clase lo ambiguo o negado («a pie», «sin vehículo»), para que la administración lo asigne.
create or replace function private.guess_vehicle_class(p_text text)
returns text language sql immutable set search_path = '' as $$
  select case
    when t.v ~ '\m(sin|no|pie|bici|bicicleta|caminando)\M' then null
    when t.v ~ 'moto' then 'moto'
    when t.v ~ '\m(carro|auto|camion|camioneta|pickup|pick-up|vehiculo|furgon|furgoneta|van|microbus)\M' then 'vehiculo'
  end
  from (select translate(lower(coalesce(p_text, '')), 'áéíóúü', 'aeiouu') as v) t;
$$;
revoke all on function private.guess_vehicle_class(text) from public, anon, authenticated;

update identity.couriers set vehicle_class = private.guess_vehicle_class(vehicle_type);

grant select (vehicle_class, department) on identity.couriers to authenticated;

create or replace view public.couriers_list with (security_invoker = true) as
  select id, full_name, phone, vehicle_type, status, user_id, created_at, vehicle_class, department
  from identity.couriers;

create or replace function public.set_courier_coverage(p_courier uuid, p_vehicle_class text, p_department text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  if p_vehicle_class is not null and p_vehicle_class not in ('moto', 'vehiculo') then
    raise exception 'el tipo de vehículo debe ser moto o vehículo' using errcode = '22023';
  end if;
  if p_department is not null and not exists (select 1 from sales.departments where code = p_department) then
    raise exception 'departamento no válido' using errcode = '22023';
  end if;
  update identity.couriers set vehicle_class = p_vehicle_class, department = p_department, updated_at = now()
   where id = p_courier;
  if not found then
    raise exception 'repartidor no encontrado' using errcode = 'P0002';
  end if;
  perform private.write_audit('courier.coverage_changed', 'courier', p_courier::text, null,
    jsonb_build_object('vehicle_class', p_vehicle_class, 'department', p_department));
end $$;

-- Límites de express ----------------------------------------------------------------------------------------------------
-- Una sola fila. El tope de distancia de express no se repite aquí: es el de la última zona de `sales.delivery_zones`.

create table sales.delivery_class_settings (
  id boolean primary key default true check (id),
  max_unit_kg numeric(6, 2) not null default 5 check (max_unit_kg > 0),
  max_side_cm numeric(6, 1) not null default 45 check (max_side_cm > 0),
  max_sum_cm numeric(6, 1) not null default 100 check (max_sum_cm > 0),
  max_order_kg numeric(6, 2) not null default 10 check (max_order_kg > 0),
  updated_at timestamptz not null default now()
);
insert into sales.delivery_class_settings default values;

alter table sales.delivery_class_settings enable row level security;
create policy delivery_class_settings_select on sales.delivery_class_settings
  for select to authenticated using (private.is_ops_console() or private.has_any_role(array['comercio']::identity.app_role[]));
grant select on sales.delivery_class_settings to authenticated;

create view public.delivery_class_settings_view with (security_invoker = true) as
  select max_unit_kg, max_side_cm, max_sum_cm, max_order_kg from sales.delivery_class_settings;
revoke all on public.delivery_class_settings_view from public, anon;
grant select on public.delivery_class_settings_view to authenticated;

create or replace function public.set_delivery_class_limits(p_unit_kg numeric, p_side_cm numeric, p_sum_cm numeric, p_order_kg numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  if p_unit_kg is null or p_side_cm is null or p_sum_cm is null or p_order_kg is null
     or p_unit_kg <= 0 or p_side_cm <= 0 or p_sum_cm <= 0 or p_order_kg <= 0 then
    raise exception 'todos los límites deben ser mayores que cero' using errcode = '22023';
  end if;
  if p_order_kg < p_unit_kg then
    raise exception 'el peso máximo del pedido no puede ser menor que el de una unidad' using errcode = '22023';
  end if;
  if p_sum_cm < p_side_cm then
    raise exception 'la suma de medidas no puede ser menor que el lado máximo' using errcode = '22023';
  end if;
  update sales.delivery_class_settings
     set max_unit_kg = p_unit_kg, max_side_cm = p_side_cm, max_sum_cm = p_sum_cm, max_order_kg = p_order_kg, updated_at = now();
  perform private.write_audit('delivery_class.limits_changed', 'settings', 'delivery_class', null,
    jsonb_build_object('max_unit_kg', p_unit_kg, 'max_side_cm', p_side_cm, 'max_sum_cm', p_sum_cm, 'max_order_kg', p_order_kg));
end $$;

-- Categorías «solo programado» ------------------------------------------------------------------------------------------

alter table commerce.master_items add column programado_only boolean not null default false;

create or replace view public.master_items_list with (security_invoker = true) as
  select m.id, m.kind, m.name, m.parent_id, p.name as parent_name, m.status, m.created_at, m.updated_at,
         m.programado_only
  from commerce.master_items m
  left join commerce.master_items p on p.id = m.parent_id;

create or replace function public.set_master_item_programado_only(p_id uuid, p_value boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item commerce.master_items;
begin
  perform private.require_admin_console();
  if p_value is null then
    raise exception 'indica si la categoría es solo programado' using errcode = '22023';
  end if;
  select * into v_item from commerce.master_items where id = p_id for update;
  if not found then
    raise exception 'elemento no encontrado' using errcode = 'P0002';
  end if;
  if v_item.kind <> 'categoria' then
    raise exception 'solo las categorías pueden ser solo programado' using errcode = '22023';
  end if;
  -- Una subcategoría hereda la marca de su categoría padre; se aplica al elemento y a sus hijas.
  update commerce.master_items set programado_only = p_value, updated_at = now()
   where id = p_id or parent_id = p_id;
  perform private.write_audit('master_item.programado_only_changed', 'master_item', p_id::text, null,
    jsonb_build_object('programado_only', p_value));
end $$;

-- Productos -------------------------------------------------------------------------------------------------------------
-- Medidas todas juntas o ninguna. Los productos anteriores quedan elegibles y sin medidas (dato desconocido) hasta que el
-- comercio las complete; los nuevos o editados con `set_product_delivery` exigen medidas para ser express.

alter table commerce.products
  add column express_eligible boolean not null default true,
  add column weight_kg numeric(7, 2) check (weight_kg is null or weight_kg > 0),
  add column length_cm numeric(6, 1) check (length_cm is null or length_cm > 0),
  add column width_cm numeric(6, 1) check (width_cm is null or width_cm > 0),
  add column height_cm numeric(6, 1) check (height_cm is null or height_cm > 0),
  add column validation_days smallint check (validation_days is null or validation_days between 0 and 60),
  add constraint products_dimensions_together check ((length_cm is null) = (width_cm is null) and (width_cm is null) = (height_cm is null));

create or replace function private.within_express_limits(p_weight numeric, p_length numeric, p_width numeric, p_height numeric)
returns boolean language sql stable security definer set search_path = '' as $$
  select (p_weight is null or p_weight <= s.max_unit_kg)
     and (p_length is null or (greatest(p_length, p_width, p_height) <= s.max_side_cm and p_length + p_width + p_height <= s.max_sum_cm))
  from sales.delivery_class_settings s;
$$;

-- ¿Puede este producto viajar en moto? Elegible, dentro de los límites vigentes y fuera de categorías «solo programado».
create or replace function private.product_express_ok(p_product uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p.express_eligible
     and private.within_express_limits(p.weight_kg, p.length_cm, p.width_cm, p.height_cm)
     and not coalesce((
       select bool_or(m.programado_only) from commerce.master_items m
       where m.id = p.category_id or m.id = (select c.parent_id from commerce.master_items c where c.id = p.category_id)
     ), false)
  from commerce.products p where p.id = p_product;
$$;

create or replace function public.set_product_delivery(
  p_product uuid, p_eligible boolean, p_weight_kg numeric, p_length_cm numeric, p_width_cm numeric, p_height_cm numeric,
  p_validation_days integer default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old commerce.products;
  v_cat_only boolean;
  v_lim sales.delivery_class_settings;
begin
  perform private.require_store_manager(private.store_commerce(private.product_store(p_product)));
  select * into v_old from commerce.products where id = p_product for update;
  if v_old.status = 'archivado' then
    raise exception 'un producto archivado no se edita' using errcode = '22023';
  end if;
  if p_eligible is null then
    raise exception 'indica si el producto puede entregarse como express' using errcode = '22023';
  end if;
  if (p_length_cm is null) <> (p_width_cm is null) or (p_width_cm is null) <> (p_height_cm is null) then
    raise exception 'las medidas van completas (largo, ancho y alto) o no van' using errcode = '22023';
  end if;
  if coalesce(p_weight_kg, 1) <= 0 or coalesce(p_length_cm, 1) <= 0 or coalesce(p_width_cm, 1) <= 0 or coalesce(p_height_cm, 1) <= 0 then
    raise exception 'el peso y las medidas deben ser mayores que cero' using errcode = '22023';
  end if;
  if p_validation_days is not null and p_validation_days not between 0 and 60 then
    raise exception 'los días de validación deben estar entre 0 y 60' using errcode = '22023';
  end if;

  if p_eligible then
    select * into v_lim from sales.delivery_class_settings;
    if p_weight_kg is null or p_length_cm is null then
      raise exception 'para entregar como express indica el peso y las medidas del producto' using errcode = '22023';
    end if;
    if p_weight_kg > v_lim.max_unit_kg then
      raise exception 'un producto express pesa hasta % kg', trim_scale(v_lim.max_unit_kg) using errcode = '22023';
    end if;
    if greatest(p_length_cm, p_width_cm, p_height_cm) > v_lim.max_side_cm or p_length_cm + p_width_cm + p_height_cm > v_lim.max_sum_cm then
      raise exception 'un producto express mide hasta % cm de lado y % cm entre largo, ancho y alto', trim_scale(v_lim.max_side_cm), trim_scale(v_lim.max_sum_cm)
        using errcode = '22023';
    end if;
    select coalesce(bool_or(m.programado_only), false) into v_cat_only from commerce.master_items m
     where m.id = v_old.category_id or m.id = (select c.parent_id from commerce.master_items c where c.id = v_old.category_id);
    if v_cat_only then
      raise exception 'la categoría del producto solo se entrega de forma programada' using errcode = '22023';
    end if;
  end if;

  update commerce.products
     set express_eligible = p_eligible, weight_kg = p_weight_kg, length_cm = p_length_cm, width_cm = p_width_cm,
         height_cm = p_height_cm, validation_days = p_validation_days, updated_at = now()
   where id = p_product;
  perform private.write_audit('product.delivery_changed', 'product', p_product::text, null,
    jsonb_build_object('express_eligible', p_eligible, 'was_eligible', v_old.express_eligible));
end $$;

create or replace view public.products_list with (security_invoker = true) as
  select p.id, p.store_id, s.name as store_name, s.commerce_id, p.name, p.description,
         p.category_id, p.brand_id, p.product_type_id, p.status, p.created_at, p.updated_at,
         (select count(*) from commerce.product_variants v where v.product_id = p.id and v.status = 'activa') as active_variants,
         (select min(v.price) from commerce.product_variants v where v.product_id = p.id and v.status = 'activa') as min_price,
         (select i.path from commerce.product_images i where i.product_id = p.id order by i.position limit 1) as cover_path,
         p.express_eligible, p.weight_kg, p.length_cm, p.width_cm, p.height_cm, p.validation_days,
         private.product_express_ok(p.id) as express_ok
  from commerce.products p
  join commerce.stores s on s.id = p.store_id;

-- Permisos --------------------------------------------------------------------------------------------------------------

revoke all on function private.within_express_limits(numeric, numeric, numeric, numeric), private.product_express_ok(uuid)
  from public, anon, authenticated;
-- `products_list` es una vista con los permisos de quien consulta y calcula `express_ok` con esta función.
grant execute on function private.product_express_ok(uuid) to authenticated;
revoke all on function public.set_store_department(uuid, text), public.set_courier_coverage(uuid, text, text),
  public.set_delivery_class_limits(numeric, numeric, numeric, numeric), public.set_master_item_programado_only(uuid, boolean),
  public.set_product_delivery(uuid, boolean, numeric, numeric, numeric, numeric, integer)
  from public, anon, authenticated;
grant execute on function public.set_store_department(uuid, text), public.set_courier_coverage(uuid, text, text),
  public.set_delivery_class_limits(numeric, numeric, numeric, numeric), public.set_master_item_programado_only(uuid, boolean),
  public.set_product_delivery(uuid, boolean, numeric, numeric, numeric, numeric, integer)
  to authenticated;
