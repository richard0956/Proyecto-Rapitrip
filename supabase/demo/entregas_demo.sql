-- Datos de DEMOSTRACIÓN para probar entregas express / programado y descuentos (no es semilla de producción; no se ejecuta con `db reset`).
-- Se corre DESPUÉS de `comercios_demo.sql`: psql -f supabase/demo/entregas_demo.sql. Se puede repetir sin duplicar nada.
-- Carga lo que la operación debe definir en producción: bandas del envío programado, días extra por departamento, departamento de tiendas
-- y repartidores (con clase de vehículo), peso y medidas de los productos, productos grandes (solo programado) y algunos descuentos.

-- 1. Bandas del envío programado (distancia por calle hasta el límite, plazo en días y tarifa en córdobas).
insert into sales.programmed_bands (band, up_to_km, min_days, max_days, courier_pay, margin) values
  (1,   60, 1, 2, 120, 40),
  (2,  150, 2, 3, 220, 60),
  (3,  300, 3, 5, 380, 90),
  (4,  600, 5, 8, 650, 150),
  (5, 2000, 7, 12, 1100, 250)
on conflict (band) do update set up_to_km = excluded.up_to_km, min_days = excluded.min_days, max_days = excluded.max_days,
  courier_pay = excluded.courier_pay, margin = excluded.margin;

-- 2. Días extra por departamento (zonas más alejadas tardan más).
update sales.departments set extra_days = v.d
from (values ('managua',0),('masaya',0),('granada',0),('carazo',0),('leon',0),('chinandega',1),('rivas',1),('esteli',1),('matagalpa',1),
             ('boaco',1),('jinotega',2),('chontales',2),('madriz',2),('nueva_segovia',2),('rio_san_juan',3),('raccn',4),('raccs',4)) as v(c, d)
where code = v.c;

-- 3. Departamento y ubicación de las tiendas: casi todas en Managua; tres en otros departamentos para probar cruces.
update commerce.stores set department = 'managua' where department is null;
update commerce.stores set department = 'matagalpa', latitude = 12.929600, longitude = -85.917500, address = 'Matagalpa, centro' where name = 'Café Los Volcanes';
update commerce.stores set department = 'leon', latitude = 12.437900, longitude = -86.878000, address = 'León, centro' where name = 'Patitas - Altamira';
update commerce.stores set department = 'granada', latitude = 11.929900, longitude = -85.956000, address = 'Granada, calle La Calzada' where name = 'Sabor Nica';

-- 4. Repartidores: motos en Managua (ya existen), una bicicleta sin clase, y vehículos en tres departamentos.
update identity.couriers set department = 'managua', vehicle_class = 'moto' where full_name in ('Pedro Repartidor', 'María Repartidora', 'Karina Repartidora');
update identity.couriers set department = 'managua', vehicle_class = null where full_name = 'Josué Repartidor';
insert into identity.couriers (full_name, phone, vehicle_type, vehicle_class, department, status)
select v.n, v.p, v.t, 'vehiculo', v.d, 'activo'
from (values ('Luis Camionero', '88890001', 'camioneta', 'managua'),
             ('Rosa Furgoneta', '88890002', 'furgón', 'leon'),
             ('Mario Camión', '88890003', 'camión', 'matagalpa'),
             ('Elena Pickup', '88890004', 'pickup', 'granada')) as v(n, p, t, d)
where not exists (select 1 from identity.couriers c where c.full_name = v.n);

-- 5. Peso y medidas: los productos pequeños quedan aptos para express; los pesados, solo programado.
update commerce.products set weight_kg = 0.4, length_cm = 15, width_cm = 10, height_cm = 8 where weight_kg is null;
update commerce.products set weight_kg = 0.8, length_cm = 40, width_cm = 30, height_cm = 15 where name = 'Mochila escolar';
update commerce.products set weight_kg = 2.5, length_cm = 31, width_cm = 22, height_cm = 25 where name = 'Resma de papel carta';
update commerce.products set weight_kg = 42.5, length_cm = 60, width_cm = 40, height_cm = 12, express_eligible = false, validation_days = 2 where name = 'Cemento gris';
update commerce.products set weight_kg = 19, length_cm = 30, width_cm = 30, height_cm = 35, express_eligible = false where name = 'Pintura blanca';
update commerce.products set weight_kg = 15, length_cm = 60, width_cm = 40, height_cm = 15, express_eligible = false where name = 'Concentrado para perro adulto';

-- 6. Productos grandes que pasan por validación: televisor, sillón y un taladro (este sí cabe en express).
create or replace function pg_temp.add_product(p_store text, p_name text, p_desc text, p_price numeric, p_sku text, p_kg numeric,
                                               p_l numeric, p_w numeric, p_h numeric, p_express boolean, p_validation smallint, p_stock int)
returns void language plpgsql as $$
declare v_store uuid; v_product uuid; v_variant uuid;
begin
  select id into v_store from commerce.stores where name = p_store;
  if v_store is null or exists (select 1 from commerce.products where store_id = v_store and lower(btrim(name)) = lower(p_name) and status <> 'archivado') then return; end if;
  insert into commerce.products (store_id, name, description, status, express_eligible, weight_kg, length_cm, width_cm, height_cm, validation_days)
  values (v_store, p_name, p_desc, 'publicado', p_express, p_kg, p_l, p_w, p_h, p_validation) returning id into v_product;
  insert into commerce.product_variants (product_id, store_id, name, sku, price) values (v_product, v_store, 'Único', p_sku, p_price) returning id into v_variant;
  insert into commerce.inventory (variant_id, store_id, track_stock, quantity) values (v_variant, v_store, true, p_stock);
end $$;

select pg_temp.add_product('Hogar Plus', 'Televisor 43 pulgadas', 'Televisor LED Full HD con control remoto.', 11500, 'TV-43-HP', 11, 100, 60, 10, false, 3::smallint, 8);
select pg_temp.add_product('Hogar Plus', 'Sillón de tres plazas', 'Sillón tapizado gris para sala.', 14500, 'SILLON-3P-HP', 35, 200, 90, 90, false, 7::smallint, 4);
select pg_temp.add_product('Ferretería El Tornillo', 'Taladro inalámbrico', 'Taladro con batería y dos brocas.', 2300, 'TALADRO-FT', 1.8, 30, 25, 10, true, null, 12);

-- 7. Descuentos de ejemplo (precio anterior tachado): se ven en el inicio, en el catálogo y en el filtro "Con descuento".
update commerce.product_variants v set compare_at_price = round(v.price * 1.25, 0)
from commerce.products p
where p.id = v.product_id and p.status = 'publicado' and v.compare_at_price is null
  and p.name in ('Mochila escolar', 'Cuaderno cosido', 'Escoba', 'Cemento gris', 'Collar ajustable', 'Taladro inalámbrico', 'Televisor 43 pulgadas');

-- Resumen
select 'bandas' as dato, count(*)::text as total from sales.programmed_bands
union all select 'tiendas con departamento', count(*)::text from commerce.stores where department is not null
union all select 'repartidores con vehículo', count(*)::text from identity.couriers where vehicle_class = 'vehiculo'
union all select 'productos con peso', count(*)::text from commerce.products where weight_kg is not null
union all select 'variantes con descuento', count(*)::text from commerce.product_variants where compare_at_price is not null;
