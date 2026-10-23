begin;
select plan(67);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

-- Tarifas programadas de prueba (en producción las define la operación) y días extra de León
reset role;
insert into sales.programmed_bands (band, up_to_km, min_days, max_days, courier_pay, margin) values
  (1, 50, 1, 3, 100, 20), (2, 400, 3, 7, 300, 50);
update sales.departments set extra_days = 2 where code = 'leon';

-- Cuatro tiendas: A, B y C en el mismo punto de Managua centro (C declarada en Granada) y D sin ubicar
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.a', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select set_config('t.b', public.create_store((select id from tc where k = 'a'), 'Tienda B')::text, true);
select set_config('t.c', public.create_store((select id from tc where k = 'a'), 'Tienda C')::text, true);
select set_config('t.d', public.create_store((select id from tc where k = 'a'), 'Tienda D')::text, true);
select public.set_store_hours(s::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d))
  from unnest(array[current_setting('t.a'), current_setting('t.b'), current_setting('t.c'), current_setting('t.d')]) s;
select public.set_store_location(s::uuid, 12.136400, -86.251400) from unnest(array[current_setting('t.a'), current_setting('t.b'), current_setting('t.c')]) s;

-- Productos: Café y Sillón en A, Pan en B, Libro en C, Mesa en A
select set_config('t.pcafe', public.create_product(current_setting('t.a')::uuid, 'Café')::text, true);
select set_config('t.vcafe', public.create_variant(current_setting('t.pcafe')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select set_config('t.psillon', public.create_product(current_setting('t.a')::uuid, 'Sillón')::text, true);
select set_config('t.vsillon', public.create_variant(current_setting('t.psillon')::uuid, 'Gris', 'SILLON-1', 8000)::text, true);
select set_config('t.pmesa', public.create_product(current_setting('t.a')::uuid, 'Mesa pequeña')::text, true);
select set_config('t.vmesa', public.create_variant(current_setting('t.pmesa')::uuid, 'Roble', 'MESA-1', 900)::text, true);
select set_config('t.ppan', public.create_product(current_setting('t.b')::uuid, 'Pan')::text, true);
select set_config('t.vpan', public.create_variant(current_setting('t.ppan')::uuid, 'Unidad', 'PAN-1', 20)::text, true);
select set_config('t.plibro', public.create_product(current_setting('t.c')::uuid, 'Libro')::text, true);
select set_config('t.vlibro', public.create_variant(current_setting('t.plibro')::uuid, 'Tapa blanda', 'LIBRO-1', 300)::text, true);
select public.set_product_status(p::uuid, 'publicado')
  from unnest(array[current_setting('t.pcafe'), current_setting('t.psillon'), current_setting('t.pmesa'), current_setting('t.ppan'), current_setting('t.plibro')]) p;
select set_config('t.i_cafe', format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vcafe')), true);
select set_config('t.i_sillon', format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vsillon')), true);
select set_config('t.i_both', format('[{"variant_id":"%s","quantity":1},{"variant_id":"%s","quantity":1}]', current_setting('t.vcafe'), current_setting('t.vsillon')), true);
select set_config('t.i_pan', format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vpan')), true);
select set_config('t.i_libro', format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vlibro')), true);

-- Elegibilidad del producto: peso y medidas obligatorios y dentro del límite
select throws_ok(format($$select public.set_product_delivery(%L, true, 6, 10, 10, 10)$$, current_setting('t.pcafe')), '22023', null::text,
  'express no admite más de 5 kg por unidad');
select throws_ok(format($$select public.set_product_delivery(%L, true, 1, 50, 10, 10)$$, current_setting('t.pcafe')), '22023', null::text,
  'express no admite un lado de más de 45 cm');
select throws_ok(format($$select public.set_product_delivery(%L, true, 1, 40, 40, 40)$$, current_setting('t.pcafe')), '22023', null::text,
  'ni más de 100 cm entre largo, ancho y alto');
select throws_ok(format($$select public.set_product_delivery(%L, true, null, null, null, null)$$, current_setting('t.pcafe')), '22023', null::text,
  'para ser express hay que declarar peso y medidas');
select throws_ok(format($$select public.set_product_delivery(%L, true, 1, 10, null, 10)$$, current_setting('t.pcafe')), '22023', null::text,
  'las medidas van completas o no van');
select lives_ok(format($$select public.set_product_delivery(%L, true, 1, 10, 10, 10)$$, current_setting('t.pcafe')), 'un café de 1 kg y 10 cm es elegible para express');
select lives_ok(format($$select public.set_product_delivery(%L, false, 40, 90, 80, 85, 3)$$, current_setting('t.psillon')), 'un sillón se declara solo programado, con 3 días de validación');
select is((select express_ok from public.products_list where id = current_setting('t.pcafe')::uuid), true, 'el café puede ir en moto');
select is((select express_ok from public.products_list where id = current_setting('t.psillon')::uuid), false, 'el sillón no');
reset role;

-- Categoría «solo programado»
select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.cat', public.create_master_item('categoria', 'Muebles')::text, true);
select lives_ok(format($$select public.set_master_item_programado_only(%L, true)$$, current_setting('t.cat')), 'el admin marca una categoría como solo programado');
select throws_ok(format($$select public.set_master_item_programado_only(%L, true)$$, (select gen_random_uuid())), 'P0002', null::text, 'la categoría debe existir');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select lives_ok(format($$select public.update_product(%L, 'Mesa pequeña', null, %L, null, null)$$, current_setting('t.pmesa'), current_setting('t.cat')), 'el comercio clasifica la mesa en Muebles');
select throws_ok(format($$select public.set_product_delivery(%L, true, 1, 10, 10, 10)$$, current_setting('t.pmesa')), '22023', null::text,
  'en una categoría solo programado no se elige express');
select lives_ok(format($$select public.set_product_delivery(%L, false, null, null, null, null)$$, current_setting('t.pmesa')), 'la mesa queda como programada');
select throws_ok(format($$select public.set_master_item_programado_only(%L, false)$$, current_setting('t.cat')), '42501', null::text,
  'el comercio no cambia las categorías');
select throws_ok($$select public.set_delivery_class_limits(5, 45, 100, 10)$$, '42501', null::text, 'ni los límites de express');
reset role;

-- Límites editables
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select public.set_delivery_class_limits(0, 45, 100, 10)$$, '22023', null::text, 'los límites deben ser positivos');
select throws_ok($$select public.set_delivery_class_limits(8, 45, 100, 5)$$, '22023', null::text, 'el pedido no puede pesar menos que una unidad');
select lives_ok($$select public.set_delivery_class_limits(5, 45, 100, 10)$$, 'el admin confirma los límites');
select is((select max_order_kg from public.delivery_class_settings_view), 10::numeric, 'la vista muestra los límites vigentes');
reset role;

-- Departamentos y repartidores
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok(format($$select public.set_store_department(%L, 'atlantida')$$, current_setting('t.a')), '22023', null::text, 'el departamento debe existir');
select public.set_store_department(s::uuid, 'managua') from unnest(array[current_setting('t.a'), current_setting('t.b')]) s;
select public.set_store_department(current_setting('t.c')::uuid, 'granada');
select is((select department from public.stores_list where id = current_setting('t.c')::uuid), 'granada', 'la lista de tiendas muestra el departamento');
select throws_ok($$select public.set_courier_coverage(gen_random_uuid(), 'moto', 'managua')$$, '42501', null::text, 'el comercio no asigna repartidores');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.courier', public.create_courier('Rep Uno', '88887777', 'Camioneta pickup', 'docs/rep1.pdf')::text, true);
select is((select vehicle_class from public.couriers_list where id = current_setting('t.courier')::uuid), null, 'un repartidor nuevo queda sin clase hasta que se asigna');
select throws_ok(format($$select public.set_courier_coverage(%L, 'avion', 'managua')$$, current_setting('t.courier')), '22023', null::text, 'el tipo de vehículo es una lista cerrada');
select lives_ok(format($$select public.set_courier_coverage(%L, 'vehiculo', 'leon')$$, current_setting('t.courier')), 'el admin asigna vehículo y departamento');
select is((select vehicle_class || '/' || department from public.couriers_list where id = current_setting('t.courier')::uuid), 'vehiculo/leon', 'la lista de repartidores los muestra');
reset role;

-- Cotización por grupo
select tests.authenticate_as((select id from tu where k = 'cli'));
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.136400, -86.251400, 'managua') -> 'shipments' -> 0 ->> 'delivery_class'),
  'express', 'un producto pequeño cerca y en el mismo departamento es express');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.136400, -86.251400, 'managua') -> 'shipments' -> 0 ->> 'customer_fee')::numeric,
  50::numeric, 'cobra el envío de la zona 1');
select is(jsonb_array_length(public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_both')::jsonb, 12.136400, -86.251400, 'managua') -> 'shipments'),
  2, 'café y sillón de una misma tienda salen en dos envíos');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_both')::jsonb, 12.136400, -86.251400, 'managua') -> 'shipments' -> 1 ->> 'reason'),
  'producto', 'el sillón es programado por el producto');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_both')::jsonb, 12.136400, -86.251400, 'managua') -> 'shipments' -> 1 ->> 'eta_min_days'),
  '4', 'el plazo suma los 3 días de validación del sillón al tramo de 1 día');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.536400, -86.251400, 'leon') -> 'shipments' -> 0 ->> 'delivery_class'),
  'programado', 'a más de 20 km todo es programado, aunque el producto sea pequeño');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.536400, -86.251400, 'leon') -> 'shipments' -> 0 ->> 'reason'),
  'otro_departamento', 'en otro departamento la razón es el departamento');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.536400, -86.251400, 'managua') -> 'shipments' -> 0 ->> 'reason'),
  'distancia', 'en el mismo departamento pero lejos la razón es la distancia');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.536400, -86.251400, 'leon') -> 'shipments' -> 0 ->> 'eta_max_days'),
  '9', 'el plazo suma los 2 días extra de León al tramo de 3 a 7 días');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.536400, -86.251400, 'managua') -> 'shipments' -> 0 ->> 'customer_fee')::numeric,
  350::numeric, 'cobra la tarifa programada del tramo (300 + 50)');
select is((public.quote_delivery_group(current_setting('t.c')::uuid, current_setting('t.i_libro')::jsonb, 12.136400, -86.251400, 'managua') -> 'shipments' -> 0 ->> 'reason'),
  'otro_departamento', 'una tienda de Granada entrega a Managua como programado aunque esté al lado');
select is((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.136400, -86.251400) -> 'shipments' -> 0 ->> 'delivery_class'),
  'express', 'sin departamento de destino solo cuenta la distancia');
select ok(not (public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.136400, -86.251400, 'managua') ? 'distance_km')
  and not ((public.quote_delivery_group(current_setting('t.a')::uuid, current_setting('t.i_cafe')::jsonb, 12.136400, -86.251400, 'managua') -> 'shipments' -> 0) ? 'courier_pay'),
  'la cotización no devuelve distancia, pago al repartidor ni margen');
select throws_ok(format($$select public.quote_delivery_group(%L, %L::jsonb, 15.136400, -86.251400, 'managua')$$, current_setting('t.a'), current_setting('t.i_cafe')),
  '22023', null::text, 'más allá de la última tarifa programada no hay envío');
select throws_ok(format($$select public.quote_delivery_group(%L, %L::jsonb, 12.136400, -86.251400, 'managua')$$, current_setting('t.d'), current_setting('t.i_pan')),
  '22023', null::text, 'una tienda sin ubicación no cotiza');
select throws_ok(format($$select public.quote_delivery_group(%L, %L::jsonb, 12.136400, -86.251400, 'atlantida')$$, current_setting('t.a'), current_setting('t.i_cafe')),
  '22023', null::text, 'el departamento de destino debe existir');
reset role;
select ok(not has_function_privilege('anon', 'public.quote_delivery_group(uuid, jsonb, numeric, numeric, text, uuid)', 'execute'), 'anon no cotiza');
select ok(not has_function_privilege('anon', 'public.create_checkout(jsonb, text, text, text, text, uuid, numeric, numeric, text)', 'execute'), 'anon no compra');

-- create_order de una tienda sigue siendo solo express
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)$$,
  current_setting('t.a'), current_setting('t.i_sillon')), '22023', null::text, 'create_order rechaza un producto que solo se entrega programado');
select lives_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)$$,
  current_setting('t.a'), current_setting('t.i_cafe')), 'create_order sigue creando pedidos express');
reset role;

-- Compra con varias tiendas
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.ref', gen_random_uuid()::text, true);
select set_config('t.groups', format('[{"store_id":"%s","items":%s},{"store_id":"%s","items":%s}]',
  current_setting('t.a'), current_setting('t.i_both'), current_setting('t.b'), current_setting('t.i_pan')), true);
select set_config('t.co1', (public.create_checkout(current_setting('t.groups')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null,
  current_setting('t.ref')::uuid, 12.136400, -86.251400, 'managua') ->> 'checkout_id'), true);
select is((select count(*)::int from public.orders_list where checkout_id = current_setting('t.co1')::uuid), 3,
  'dos tiendas con un producto programado producen tres pedidos');
select is((select count(*)::int from public.orders_list where checkout_id = current_setting('t.co1')::uuid and delivery_class = 'express'), 2,
  'dos son express');
select is((select delivery_class || '/' || class_reason || '/' || eta_min_days || '/' || delivery_fee from public.orders_list
  where checkout_id = current_setting('t.co1')::uuid and delivery_class = 'programado'), 'programado/producto/4/120.00',
  'el programado guarda clase, razón, plazo y su tarifa (100 + 20)');
select is((select total from public.my_checkouts where id = current_setting('t.co1')::uuid),
  (select sum(total) from public.orders_list where checkout_id = current_setting('t.co1')::uuid),
  'el total de la compra es la suma de sus pedidos');
select is((select order_count from public.my_checkouts where id = current_setting('t.co1')::uuid), 3::smallint, 'la compra cuenta sus pedidos');
reset role;
select is((select origin_department || '/' || destination_department from sales.orders where checkout_id = current_setting('t.co1')::uuid and delivery_class = 'programado'),
  'managua/managua', 'el pedido guarda origen y destino');
select ok(exists (select 1 from audit.events where action = 'checkout.created'), 'la compra queda auditada');

-- Idempotencia: la misma referencia devuelve la misma compra
select tests.authenticate_as((select id from tu where k = 'cli'));
select is((public.create_checkout(current_setting('t.groups')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null,
  current_setting('t.ref')::uuid, 12.136400, -86.251400, 'managua') ->> 'checkout_id')::uuid, current_setting('t.co1')::uuid,
  'repetir el intento devuelve la compra ya creada');
select is((select count(*)::int from public.my_checkouts), 1, 'sin duplicar la compra');

-- Todo o nada: una tienda que falla impide toda la compra y el mensaje dice cuál
select throws_ok(format($$select public.create_checkout('[{"store_id":"%s","items":%s},{"store_id":"%s","items":%s}]'::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')$$,
  current_setting('t.b'), current_setting('t.i_pan'), current_setting('t.d'), current_setting('t.i_pan')),
  '22023', null::text, 'una tienda sin ubicación hace fallar la compra completa');
select is((select count(*)::int from public.orders_list), 4, 'no se creó ningún pedido de esa compra');
select is((select count(*)::int from public.my_checkouts), 1, 'ni la compra');
select throws_like(format($$select public.create_checkout('[{"store_id":"%s","items":%s}]'::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')$$,
  current_setting('t.d'), current_setting('t.i_pan')), 'Tienda D:%', 'el error nombra la tienda que falló');
select throws_ok(format($$select public.create_checkout('[{"store_id":"%s","items":%s},{"store_id":"%s","items":%s}]'::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')$$,
  current_setting('t.b'), current_setting('t.i_pan'), current_setting('t.b'), current_setting('t.i_pan')),
  '22023', null::text, 'una tienda no puede repetirse');
select throws_ok(format($$select public.create_checkout('[]'::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')$$),
  '22023', null::text, 'la compra necesita al menos una tienda');
select throws_ok(format($$select public.create_checkout('[{"store_id":"%s","items":%s}]'::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, null, null, 'managua')$$,
  current_setting('t.a'), current_setting('t.i_cafe')), '22023', null::text, 'sin pin no hay compra');

-- Peso máximo del envío express (11 kg de café)
select throws_ok(format($$select public.create_checkout('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":11}]}]'::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')$$,
  current_setting('t.a'), current_setting('t.vcafe')), '22023', null::text, 'un envío express no puede pesar más de 10 kg');
reset role;

-- Quién ve qué
select is(tests.count_as((select id from tu where k = 'cli2'), 'public.my_checkouts'), 0::bigint, 'otro cliente no ve la compra');
select is(tests.count_as((select id from tu where k = 'adm'), 'public.programmed_bands_list'), 2::bigint, 'la administración ve las tarifas programadas');
select is(tests.count_as((select id from tu where k = 'cli'), 'public.programmed_bands_list'), 0::bigint, 'el cliente no las lee directamente');

select * from finish();
rollback;
