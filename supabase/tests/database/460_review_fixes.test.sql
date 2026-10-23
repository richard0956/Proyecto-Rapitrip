begin;
select plan(23);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select k, tests.create_user(k || '@t.test') from unnest(array['c1', 'c2', 'c3', 'c4']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

-- ===== Clasificación de vehículos: palabras completas, sin trozos ni negaciones =====
select is(private.guess_vehicle_class('Moto Honda 150'), 'moto', 'una moto es moto');
select is(private.guess_vehicle_class('Motocicleta'), 'moto', 'motocicleta también');
select is(private.guess_vehicle_class('Camioneta pickup'), 'vehiculo', 'una camioneta es vehículo');
select is(private.guess_vehicle_class('Camión'), 'vehiculo', 'con tilde también');
select is(private.guess_vehicle_class('van'), 'vehiculo', 'una van es vehículo');
select is(private.guess_vehicle_class('A pie (sin vehículo)'), null, 'a pie, sin vehículo, queda sin clase');
select is(private.guess_vehicle_class('Avanzado'), null, '«van» dentro de otra palabra no cuenta');
select is(private.guess_vehicle_class('Automático'), null, '«auto» dentro de otra palabra tampoco');
select is(private.guess_vehicle_class('Bicicleta'), null, 'una bicicleta no es moto ni vehículo');
select is(private.guess_vehicle_class('sin moto'), null, 'una negación deja sin clase');
select is(private.guess_vehicle_class(null), null, 'sin texto no hay clase');

-- Tres tiendas en Managua, cada una con un café (express) y un sillón (programado)
reset role;
insert into sales.programmed_bands (band, up_to_km, min_days, max_days, courier_pay, margin) values (1, 50, 1, 3, 100, 20);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s1', public.create_store((select id from tc where k = 'a'), 'Tienda 1')::text, true);
select set_config('t.s2', public.create_store((select id from tc where k = 'a'), 'Tienda 2')::text, true);
select set_config('t.s3', public.create_store((select id from tc where k = 'a'), 'Tienda 3')::text, true);
select public.set_store_hours(s::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d))
  from unnest(array[current_setting('t.s1'), current_setting('t.s2'), current_setting('t.s3')]) s;
select public.set_store_location(s::uuid, 12.136400, -86.251400) from unnest(array[current_setting('t.s1'), current_setting('t.s2'), current_setting('t.s3')]) s;
select public.set_store_department(s::uuid, 'managua') from unnest(array[current_setting('t.s1'), current_setting('t.s2'), current_setting('t.s3')]) s;
select set_config('t.cafe1', public.create_variant(public.create_product(current_setting('t.s1')::uuid, 'Café 1'), '500 g', 'CAFE-1', 150)::text, true);
select set_config('t.cafe2', public.create_variant(public.create_product(current_setting('t.s2')::uuid, 'Café 2'), '500 g', 'CAFE-2', 150)::text, true);
select set_config('t.cafe3', public.create_variant(public.create_product(current_setting('t.s3')::uuid, 'Café 3'), '500 g', 'CAFE-3', 150)::text, true);
select set_config('t.sil1', public.create_variant(public.create_product(current_setting('t.s1')::uuid, 'Sillón 1'), 'Gris', 'SIL-1', 8000)::text, true);
select set_config('t.sil2', public.create_variant(public.create_product(current_setting('t.s2')::uuid, 'Sillón 2'), 'Gris', 'SIL-2', 8000)::text, true);
select set_config('t.sil3', public.create_variant(public.create_product(current_setting('t.s3')::uuid, 'Sillón 3'), 'Gris', 'SIL-3', 8000)::text, true);
select public.set_product_status(p.id, 'publicado') from public.products_list p where p.store_id in (current_setting('t.s1')::uuid, current_setting('t.s2')::uuid, current_setting('t.s3')::uuid);
select public.set_product_delivery(p.id, true, 1, 10, 10, 10) from public.products_list p where p.name like 'Café %' and p.store_id in (current_setting('t.s1')::uuid, current_setting('t.s2')::uuid, current_setting('t.s3')::uuid);
select public.set_product_delivery(p.id, false, 40, 90, 80, 85) from public.products_list p where p.name like 'Sillón %' and p.store_id in (current_setting('t.s1')::uuid, current_setting('t.s2')::uuid, current_setting('t.s3')::uuid);
reset role;

-- ===== 2) Una compra de 6 pedidos no se cuenta a sí misma contra el tope =====
select set_config('t.seis', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1},{"variant_id":"%s","quantity":1}]},{"store_id":"%s","items":[{"variant_id":"%s","quantity":1},{"variant_id":"%s","quantity":1}]},{"store_id":"%s","items":[{"variant_id":"%s","quantity":1},{"variant_id":"%s","quantity":1}]}]',
  current_setting('t.s1'), current_setting('t.cafe1'), current_setting('t.sil1'),
  current_setting('t.s2'), current_setting('t.cafe2'), current_setting('t.sil2'),
  current_setting('t.s3'), current_setting('t.cafe3'), current_setting('t.sil3')), true);
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.co1', public.create_checkout(current_setting('t.seis')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select is((select count(*)::int from sales.orders where checkout_id = current_setting('t.co1')::uuid), 6, 'una compra de tres tiendas con productos express y programados crea seis pedidos');

-- El tope sigue protegiendo: con 5 pedidos abiertos no se empieza otra compra ni otro pedido
reset role;
select tests.authenticate_as((select id from tu where k = 'c2'));
select public.create_order(current_setting('t.s1')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.cafe1'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400) from generate_series(1, 5);
select throws_ok(format($$select public.create_checkout(%L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')$$, current_setting('t.seis')),
  '22023', null::text, 'con 5 pedidos abiertos no se empieza una compra');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)$$,
  current_setting('t.s1'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.cafe1'))), '22023', null::text, 'ni un pedido suelto');
reset role;

-- ===== 1) Un pedido cancelado entre dos sesiones de pago no se reembolsa =====
reset role;
select tests.authenticate_as((select id from tu where k = 'c3'));
select set_config('t.co3', public.create_checkout(format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]},{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]',
  current_setting('t.s1'), current_setting('t.cafe1'), current_setting('t.s2'), current_setting('t.cafe2'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.o3a', (select id::text from sales.orders where checkout_id = current_setting('t.co3')::uuid order by number limit 1), true);
select set_config('t.o3b', (select id::text from sales.orders where checkout_id = current_setting('t.co3')::uuid order by number desc limit 1), true);
select is((public.record_checkout_payment_session(current_setting('t.co3')::uuid, 'cs_test_fix00001', 'nio') ->> 'amount')::bigint, 40000::bigint, 'la primera sesión cubre los dos pedidos (2 × 200)');
reset role;
select tests.authenticate_as((select id from tu where k = 'c3'));
select public.set_order_status(current_setting('t.o3b')::uuid, 'cancelado', 'me equivoqué de tienda');
reset role;
select is((public.record_checkout_payment_session(current_setting('t.co3')::uuid, 'cs_test_fix00002', 'nio') ->> 'amount')::bigint, 20000::bigint, 'la segunda sesión solo cubre el pedido que sigue pendiente');
select is((select payment_amount from sales.orders where id = current_setting('t.o3b')::uuid), null::bigint, 'el pedido cancelado ya no conserva el monto de la sesión vieja');
select is(public.apply_stripe_checkout_event('evt_fix000001', 'checkout.session.completed', current_setting('t.co3')::uuid, 'cs_test_fix00002', 'pi_test_fix001', 20000, 'nio', true),
  'pagado', 'el pago es completo: no hay nada que devolver');
select is((select payment_status from sales.orders where id = current_setting('t.o3b')::uuid), 'pendiente', 'el pedido cancelado no queda en reembolso');
select is((select count(*)::int from public.claim_pending_refunds(50) where order_id = current_setting('t.o3b')::uuid), 0, 'y la cola de reembolsos no lo incluye');
select is((select payment_status from sales.orders where id = current_setting('t.o3a')::uuid), 'pagado', 'el pedido que sí se pagó queda pagado');

-- ===== 5) Despachar vuelve a comprobar al repartidor =====
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.van', public.create_courier('Camioneta Managua', '88880002', 'camioneta')::text, true);
select public.set_courier_coverage(current_setting('t.van')::uuid, 'vehiculo', 'managua');
reset role;
select tests.authenticate_as((select id from tu where k = 'c4'));
select set_config('t.co4', public.create_checkout(format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.s1'), current_setting('t.sil1'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.p4', (select id::text from sales.orders where checkout_id = current_setting('t.co4')::uuid), true);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.p4')::uuid, s) from unnest(array['confirmado', 'preparando', 'listo']) s;
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(current_setting('t.p4')::uuid, current_setting('t.van')::uuid);
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.set_courier_coverage(current_setting('t.van')::uuid, 'moto', 'managua');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.set_order_status(%L, 'en_camino')$$, current_setting('t.p4')), '22023', null::text, 'si el repartidor dejó de servir, no se despacha');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.set_courier_coverage(current_setting('t.van')::uuid, 'vehiculo', 'managua');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select lives_ok(format($$select public.set_order_status(%L, 'en_camino')$$, current_setting('t.p4')), 'con el repartidor correcto, sí');
reset role;

select * from finish();
rollback;
