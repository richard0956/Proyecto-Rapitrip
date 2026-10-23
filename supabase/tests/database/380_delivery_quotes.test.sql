begin;
select plan(17);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

-- Dos tiendas ubicadas en Managua centro, con un producto cada una
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.a', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.a')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.a')::uuid, 12.136400, -86.251400);
select set_config('t.b', public.create_store((select id from tc where k = 'a'), 'Tienda B')::text, true);
select public.set_store_hours(current_setting('t.b')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.b')::uuid, 12.136400, -86.251400);
select set_config('t.prod', public.create_product(current_setting('t.a')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');
select set_config('t.prodb', public.create_product(current_setting('t.b')::uuid, 'Pan')::text, true);
select set_config('t.varb', public.create_variant(current_setting('t.prodb')::uuid, 'Unidad', 'PAN-1', 20)::text, true);
select public.set_product_status(current_setting('t.prodb')::uuid, 'publicado');
reset role;

-- Solo la función de borde (clave de servicio) escribe cotizaciones y lee el punto de la tienda
select ok(has_function_privilege('service_role', 'public.record_delivery_quote(uuid, uuid, numeric, numeric, numeric)', 'execute'), 'la función de borde puede guardar cotizaciones');
select ok(not has_function_privilege('authenticated', 'public.record_delivery_quote(uuid, uuid, numeric, numeric, numeric)', 'execute'), 'un cliente no puede guardar sus propias cotizaciones');
select ok(not has_function_privilege('anon', 'public.record_delivery_quote(uuid, uuid, numeric, numeric, numeric)', 'execute'), 'anon tampoco');
select ok(not has_function_privilege('authenticated', 'public.delivery_store_point(uuid)', 'execute'), 'el punto de la tienda no se lee desde el navegador');

-- Cotizaciones: 7 km por calle es la zona 3; sin ruta se cae a la línea recta
select set_config('t.q1', (public.record_delivery_quote((select id from tu where k = 'cli'), current_setting('t.a')::uuid, 12.159400, -86.274400, 7.04) ->> 'quote_id'), true);
select is((select zone::int || '/' || customer_fee || '/' || method || '/' || distance_km from sales.delivery_quotes where id = current_setting('t.q1')::uuid),
  '3/90.00/ruta/7.0', 'con ruta de 7 km: zona 3, cobro 90, método ruta');
select is((public.record_delivery_quote((select id from tu where k = 'cli'), current_setting('t.a')::uuid, 12.136400 + 0.017966, -86.251400) ->> 'method'),
  'linea_recta', 'sin ruta se usa la línea recta');
select throws_ok(format($$select public.record_delivery_quote(%L, %L, 12.159400, -86.274400, 21)$$, (select id from tu where k = 'cli'), current_setting('t.a')),
  '22023', null::text, 'más de 20 km por calle no se entrega');
select throws_ok(format($$select public.record_delivery_quote(%L, %L, 40.7, -74.0, 5)$$, (select id from tu where k = 'cli'), current_setting('t.a')),
  '22023', null::text, 'un punto fuera de Nicaragua se rechaza');

-- create_order usa la cotización
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.a')::uuid, format('[{"variant_id":"%s","quantity":2}]', current_setting('t.var'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.159400, -86.274400, current_setting('t.q1')::uuid)::text, true);
select is((select total from public.orders_list where id = current_setting('t.o1')::uuid), 390::numeric, 'total = 2 × 150 + 90 de la zona por ruta');
reset role;
select is((select delivery_zone::int || '/' || delivery_distance_km || '/' || delivery_method || '/' || courier_pay from sales.orders where id = current_setting('t.o1')::uuid),
  '3/7.0/ruta/80.00', 'el pedido guarda zona, distancia por calle, método y pago al repartidor');

-- Una cotización solo sirve para su cliente, su tienda, su punto y mientras está vigente
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Otro punto', '88881111', null, null, 12.130000, -86.260000, %L)$$,
  current_setting('t.a'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var')), current_setting('t.q1')), '22023', null::text,
  'una cotización no vale para otro punto');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Otra tienda', '88881111', null, null, 12.159400, -86.274400, %L)$$,
  current_setting('t.b'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.varb')), current_setting('t.q1')), '22023', null::text,
  'ni para otra tienda');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli2'));
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Ajena', '88881111', null, null, 12.159400, -86.274400, %L)$$,
  current_setting('t.a'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var')), current_setting('t.q1')), '22023', null::text,
  'ni para otro cliente');
reset role;
update sales.delivery_quotes set expires_at = now() - interval '1 minute' where id = current_setting('t.q1')::uuid;
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Vencida', '88881111', null, null, 12.159400, -86.274400, %L)$$,
  current_setting('t.a'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var')), current_setting('t.q1')), '22023', null::text,
  'una cotización vencida se rechaza');
-- Sin cotización sigue funcionando por línea recta
select set_config('t.o2', public.create_order(current_setting('t.a')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb,
  'efectivo', 'Sin cotización', '88881111', null, null, 12.136400 + 0.017966, -86.251400)::text, true);
reset role;
select is((select delivery_method || '/' || delivery_zone::int from sales.orders where id = current_setting('t.o2')::uuid), 'linea_recta/1',
  'sin cotización, el pedido se cobra por línea recta (zona 1)');
select ok(exists (select 1 from audit.events where action = 'order.delivery_priced' and after_data ->> 'method' = 'ruta'), 'la auditoría guarda el método de cálculo');
select ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_order' and pronargs = 9), 'no queda la versión anterior de create_order');

select * from finish();
rollback;
