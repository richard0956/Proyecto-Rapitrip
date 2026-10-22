begin;
select plan(21);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');

-- Dos tiendas: A ubicada en Managua centro y B sin ubicar. Con factor de ruta 1,30 la zona sale de la distancia recta por 1,3.
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.a', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.a')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.a')::uuid, 12.136400, -86.251400);
select set_config('t.b', public.create_store((select id from tc where k = 'a'), 'Tienda B')::text, true);
select public.set_store_hours(current_setting('t.b')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prod', public.create_product(current_setting('t.a')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');
select set_config('t.prodb', public.create_product(current_setting('t.b')::uuid, 'Pan')::text, true);
select set_config('t.varb', public.create_variant(current_setting('t.prodb')::uuid, 'Unidad', 'PAN-1', 20)::text, true);
select public.set_product_status(current_setting('t.prodb')::uuid, 'publicado');
reset role;

-- Tabulador: una zona por cada tramo (distancias rectas de 2, 3,5, 6, 9 y 13 km al norte de la tienda)
select tests.authenticate_as((select id from tu where k = 'cli'));
select is((public.quote_delivery(current_setting('t.a')::uuid, 12.136400 + 0.017966, -86.251400) ->> 'fee')::numeric, 50::numeric, 'zona 1: hasta 3 km cuesta 50');
select is((public.quote_delivery(current_setting('t.a')::uuid, 12.136400 + 0.031441, -86.251400) ->> 'fee')::numeric, 65::numeric, 'zona 2: hasta 6 km cuesta 65');
select is((public.quote_delivery(current_setting('t.a')::uuid, 12.136400 + 0.053898, -86.251400) ->> 'fee')::numeric, 90::numeric, 'zona 3: hasta 10 km cuesta 90');
select is((public.quote_delivery(current_setting('t.a')::uuid, 12.136400 + 0.080847, -86.251400) ->> 'fee')::numeric, 125::numeric, 'zona 4: hasta 15 km cuesta 125');
select is((public.quote_delivery(current_setting('t.a')::uuid, 12.136400 + 0.116774, -86.251400) ->> 'fee')::numeric, 155::numeric, 'zona 5: hasta 20 km cuesta 155');
select is((public.quote_delivery(current_setting('t.a')::uuid, 12.136400 + 0.031441, -86.251400) ->> 'zone')::int, 2, 'la cotización dice la zona');
select ok(not (public.quote_delivery(current_setting('t.a')::uuid, 12.136400 + 0.031441, -86.251400) ? 'distance_km'),
  'la cotización no devuelve la distancia: no sirve para ubicar la tienda');
select throws_ok(format($$select public.quote_delivery(%L, %s, -86.251400)$$, current_setting('t.a'), 12.136400 + 0.143728), '22023', null::text,
  'más allá de 20 km no se entrega');
select throws_ok(format($$select public.quote_delivery(%L, null, null)$$, current_setting('t.a')), '22023', null::text, 'sin pin no hay cotización');
select throws_ok(format($$select public.quote_delivery(%L, 40.7, -74.0)$$, current_setting('t.a')), '22023', null::text, 'un punto fuera de Nicaragua se rechaza');
select throws_ok(format($$select public.quote_delivery(%L, 12.14, -86.25)$$, current_setting('t.b')), '22023', null::text,
  'una tienda sin ubicación no cotiza ni recibe pedidos');

-- El pedido cobra la zona y la guarda
select set_config('t.o1', public.create_order(current_setting('t.a')::uuid, format('[{"variant_id":"%s","quantity":2}]', current_setting('t.var'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400 + 0.031441, -86.251400)::text, true);
select is((select total from public.orders_list where id = current_setting('t.o1')::uuid), 365::numeric, 'total = 2 × 150 + 65 de envío de la zona 2');
select is((select delivery_fee from public.orders_list where id = current_setting('t.o1')::uuid), 65::numeric, 'el envío del pedido es el de la zona');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Lejos', '88881111', null, null, %s, -86.251400)$$,
  current_setting('t.a'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var')), 12.136400 + 0.143728), '22023', null::text,
  'no se crea un pedido fuera de cobertura');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Sin pin', '88881111')$$,
  current_setting('t.a'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))), '22023', null::text, 'sin pin no se crea el pedido');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Tienda sin ubicar', '88881111', null, null, 12.14, -86.25)$$,
  current_setting('t.b'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.varb'))), '22023', null::text,
  'una tienda sin ubicación no recibe pedidos');
reset role;

select is((select delivery_zone::int || '/' || courier_pay || '/' || delivery_margin from sales.orders where id = current_setting('t.o1')::uuid), '2/55.00/10.00',
  'el pedido guarda la zona, el pago al repartidor y el margen para liquidar');
select ok(exists (select 1 from audit.events where action = 'order.delivery_priced' and after_data ->> 'delivery_fee' = '65.00'),
  'el cobro del envío queda auditado');

-- Quién ve qué
select ok(not has_function_privilege('anon', 'public.quote_delivery(uuid, numeric, numeric)', 'execute'), 'anon no cotiza entregas');
select is(tests.count_as((select id from tu where k = 'coo'), 'public.delivery_zones_list'), 5::bigint, 'coordinación ve el tabulador de zonas');
select is(tests.count_as((select id from tu where k = 'cli'), 'public.delivery_zones_list'), 0::bigint, 'el cliente no lo lee directamente');

select * from finish();
rollback;
