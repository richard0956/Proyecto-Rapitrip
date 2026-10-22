begin;
select plan(49);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select k, tests.create_user(k || '@t.test') from unnest(array['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

-- Tarifa programada de prueba y una tienda en Managua con un producto pequeño (express) y un sillón (programado, 4 días de validación).
reset role;
insert into sales.programmed_bands (band, up_to_km, min_days, max_days, courier_pay, margin) values (1, 50, 1, 3, 100, 20);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.s')::uuid, 'managua');
select set_config('t.pc', public.create_product(current_setting('t.s')::uuid, 'Café')::text, true);
select set_config('t.vc', public.create_variant(current_setting('t.pc')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select set_config('t.ps', public.create_product(current_setting('t.s')::uuid, 'Sillón')::text, true);
select set_config('t.vs', public.create_variant(current_setting('t.ps')::uuid, 'Gris', 'SILLON-1', 8000)::text, true);
select public.set_product_status(p::uuid, 'publicado') from unnest(array[current_setting('t.pc'), current_setting('t.ps')]) p;
select public.set_product_delivery(current_setting('t.pc')::uuid, true, 1, 10, 10, 10);
select public.set_product_delivery(current_setting('t.ps')::uuid, false, 40, 90, 80, 85, 4);
reset role;

-- Repartidores: moto en Managua, vehículo en Managua, vehículo en León y uno sin clasificar
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.moto', public.create_courier('Moto Managua', '88880001', 'moto')::text, true);
select set_config('t.van', public.create_courier('Camioneta Managua', '88880002', 'camioneta')::text, true);
select set_config('t.vanleon', public.create_courier('Camioneta León', '88880003', 'camioneta')::text, true);
select set_config('t.raw', public.create_courier('Sin clasificar', '88880004', 'otro')::text, true);
select public.set_courier_coverage(current_setting('t.moto')::uuid, 'moto', 'managua');
select public.set_courier_coverage(current_setting('t.van')::uuid, 'vehiculo', 'managua');
select public.set_courier_coverage(current_setting('t.vanleon')::uuid, 'vehiculo', 'leon');
reset role;

select set_config('t.cafe', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vc')), true);
select set_config('t.sillon', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vs')), true);
select set_config('t.ambos', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1},{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vc'), current_setting('t.vs')), true);

-- ===== Validación: un café (express) y un sillón (programado) en la misma compra =====
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.co1', public.create_checkout(current_setting('t.ambos')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.e1', (select id::text from sales.orders where checkout_id = current_setting('t.co1')::uuid and delivery_class = 'express'), true);
select set_config('t.p1', (select id::text from sales.orders where checkout_id = current_setting('t.co1')::uuid and delivery_class = 'programado'), true);

select ok((select expires_at from sales.orders where id = current_setting('t.p1')::uuid) > now() + interval '23 hours', 'un programado en efectivo da 24 horas al comercio para responder');
select ok((select expires_at from sales.orders where id = current_setting('t.e1')::uuid) < now() + interval '1 hour', 'un express, 45 minutos');
select is((select eta_min_days || '-' || eta_max_days from sales.orders where id = current_setting('t.p1')::uuid), '5-7', 'el plazo del programado suma sus 4 días de validación al tramo');

reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok(format($$select public.set_order_status(%L, 'en_validacion')$$, current_setting('t.e1')), '42501', null::text, 'un pedido express no pasa por validación');
select lives_ok(format($$select public.set_order_status(%L, 'en_validacion')$$, current_setting('t.p1')), 'el comercio empieza a validar un programado');
reset role;
select is((select status from sales.orders where id = current_setting('t.p1')::uuid), 'en_validacion', 'el pedido queda en validación');
select ok((select expires_at from sales.orders where id = current_setting('t.p1')::uuid) between now() + interval '6 days 23 hours' and now() + interval '7 days 1 hour',
  'y tiene como plazo los días máximos de su entrega');
select ok(exists (select 1 from sales.order_events where order_id = current_setting('t.p1')::uuid and to_status = 'en_validacion'), 'el cambio queda en el historial');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok(format($$select public.set_order_status(%L, 'preparando')$$, current_setting('t.p1')), '42501', null::text, 'no se salta la confirmación');
select throws_ok(format($$select public.set_order_status(%L, 'en_validacion')$$, current_setting('t.p1')), '42501', null::text, 'ni se valida dos veces');
select lives_ok(format($$select public.set_order_status(%L, 'confirmado')$$, current_setting('t.p1')), 'validado, el comercio lo confirma');
reset role;
select is((select status from sales.orders where id = current_setting('t.p1')::uuid), 'confirmado', 'el pedido queda confirmado');
select ok((select expires_at from sales.orders where id = current_setting('t.p1')::uuid) is null, 'y ya no vence');

-- Rechazo y cancelación durante la validación
reset role;
select tests.authenticate_as((select id from tu where k = 'c2'));
select set_config('t.co2', public.create_checkout(current_setting('t.sillon')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.p2', (select id::text from sales.orders where checkout_id = current_setting('t.co2')::uuid), true);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.p2')::uuid, 'en_validacion');
select throws_ok(format($$select public.set_order_status(%L, 'rechazado', 'no')$$, current_setting('t.p2')), '22023', null::text, 'rechazar exige motivo');
select lives_ok(format($$select public.set_order_status(%L, 'rechazado', 'no conseguimos el sillón')$$, current_setting('t.p2')), 'el comercio rechaza un pedido en validación');
reset role;
select is((select status from sales.orders where id = current_setting('t.p2')::uuid), 'rechazado', 'queda rechazado');

reset role;
select tests.authenticate_as((select id from tu where k = 'c3'));
select set_config('t.co3', public.create_checkout(current_setting('t.sillon')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.p3', (select id::text from sales.orders where checkout_id = current_setting('t.co3')::uuid), true);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.p3')::uuid, 'en_validacion');
reset role;
select tests.authenticate_as((select id from tu where k = 'c3'));
select lives_ok(format($$select public.set_order_status(%L, 'cancelado', 'ya no lo quiero')$$, current_setting('t.p3')), 'el cliente cancela mientras se valida');
reset role;
select is((select status from sales.orders where id = current_setting('t.p3')::uuid), 'cancelado', 'queda cancelado');

-- Vencimiento
reset role;
select tests.authenticate_as((select id from tu where k = 'c4'));
select set_config('t.co4', public.create_checkout(current_setting('t.sillon')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.p4', (select id::text from sales.orders where checkout_id = current_setting('t.co4')::uuid), true);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.p4')::uuid, 'en_validacion');
reset role;
update sales.orders set expires_at = now() - interval '1 minute' where id = current_setting('t.p4')::uuid;
select ok(private.expire_stale_orders() >= 1, 'el vencimiento recoge pedidos en validación');
select is((select status || '/' || status_reason from sales.orders where id = current_setting('t.p4')::uuid), 'cancelado/validación vencida', 'un pedido que nadie valida vence con su motivo');

reset role;
select tests.authenticate_as((select id from tu where k = 'c5'));
select set_config('t.co5', public.create_checkout(current_setting('t.sillon')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.p5', (select id::text from sales.orders where checkout_id = current_setting('t.co5')::uuid), true);
update sales.orders set expires_at = now() - interval '1 minute' where id = current_setting('t.p5')::uuid;
select private.expire_stale_orders();
select is((select status_reason from sales.orders where id = current_setting('t.p5')::uuid), 'vencido sin respuesta', 'un programado que el comercio nunca respondió vence sin respuesta');

-- Pago con tarjeta: el plazo del comercio depende de la clase
reset role;
select tests.authenticate_as((select id from tu where k = 'c6'));
select set_config('t.co6', public.create_checkout(current_setting('t.sillon')::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
select set_config('t.co7', public.create_checkout(current_setting('t.cafe')::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select public.mark_order_paid(id) from sales.orders where checkout_id in (current_setting('t.co6')::uuid, current_setting('t.co7')::uuid);
select ok((select expires_at from sales.orders where checkout_id = current_setting('t.co6')::uuid) > now() + interval '23 hours', 'un programado pagado con tarjeta da 24 horas al comercio');
select ok((select expires_at from sales.orders where checkout_id = current_setting('t.co7')::uuid) < now() + interval '1 hour', 'un express pagado, 45 minutos');

-- ===== Despacho por vehículo y departamento =====
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.p1'), current_setting('t.moto')), '22023', null::text, 'un programado no lo lleva una moto');
select throws_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.p1'), current_setting('t.raw')), '22023', null::text, 'ni un repartidor sin clasificar');
select throws_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.p1'), current_setting('t.vanleon')), '22023', null::text, 'ni un vehículo de otro departamento');
select throws_ok(format($$select public.assign_order_courier(%L, gen_random_uuid())$$, current_setting('t.p1')), 'P0002', null::text, 'el repartidor debe existir');
select lives_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.p1'), current_setting('t.van')), 'un vehículo del departamento de la tienda sí');
reset role;
select is((select courier_id from sales.orders where id = current_setting('t.p1')::uuid), current_setting('t.van')::uuid, 'el repartidor queda asignado');

-- Un express lo lleva cualquiera (moto, vehículo o sin clasificar)
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.e1')::uuid, 'confirmado');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select lives_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.e1'), current_setting('t.moto')), 'un express lo lleva una moto');
select lives_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.e1'), current_setting('t.van')), 'o un vehículo');
select lives_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.e1'), current_setting('t.raw')), 'o uno sin clasificar');

-- ===== Reclasificación =====
select lives_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.e1'), current_setting('t.moto')), 'el repartidor en moto queda asignado al express');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok(format($$select public.reclassify_order(%L, 'no cabe en la moto')$$, current_setting('t.e1')), '42501', null::text, 'el comercio no reclasifica');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.reclassify_order(%L, 'no')$$, current_setting('t.e1')), '22023', null::text, 'reclasificar exige un motivo');
select throws_ok($$select public.reclassify_order(gen_random_uuid(), 'no cabe en la moto')$$, 'P0002', null::text, 'el pedido debe existir');
select lives_ok(format($$select public.reclassify_order(%L, 'el café resultó ser un saco de 20 kg')$$, current_setting('t.e1')), 'coordinación reclasifica un express a programado');
reset role;
select is((select delivery_class || '/' || class_reason from sales.orders where id = current_setting('t.e1')::uuid), 'programado/producto', 'el pedido pasa a programado');
select is((select courier_id from sales.orders where id = current_setting('t.e1')::uuid), null::uuid, 'se le quita el repartidor en moto');
select is((select eta_min_days || '-' || eta_max_days || '/' || courier_pay || '/' || delivery_margin || '/' || delivery_fee from sales.orders where id = current_setting('t.e1')::uuid), '1-3/100.00/-50.00/50.00',
  'plazo y pago al repartidor salen del tramo; lo que pagó el cliente no cambia');
select is((select reclassified_reason from public.orders_list where id = current_setting('t.e1')::uuid), 'el café resultó ser un saco de 20 kg', 'el motivo queda a la vista');
select ok(exists (select 1 from audit.events where action = 'order.reclassified' and reason = 'el café resultó ser un saco de 20 kg'), 'la reclasificación queda auditada');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.reclassify_order(%L, 'otra vez no cabe')$$, current_setting('t.e1')), '22023', null::text, 'un programado no se reclasifica de nuevo');
select throws_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.e1'), current_setting('t.moto')), '22023', null::text, 'y ya no se le asigna una moto');
select lives_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.e1'), current_setting('t.van')), 'sí un vehículo');

-- Un pedido que ya salió no se reclasifica
reset role;
select tests.authenticate_as((select id from tu where k = 'c7'));
select set_config('t.co8', public.create_checkout(current_setting('t.cafe')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.e2', (select id::text from sales.orders where checkout_id = current_setting('t.co8')::uuid), true);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.e2')::uuid, s) from unnest(array['confirmado', 'preparando', 'listo']) s;
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(current_setting('t.e2')::uuid, current_setting('t.moto')::uuid);
select public.set_order_status(current_setting('t.e2')::uuid, 'en_camino');
select throws_ok(format($$select public.reclassify_order(%L, 'ya va en camino')$$, current_setting('t.e2')), '22023', null::text, 'un pedido en camino no se reclasifica');
reset role;

-- Métrica por comercio
select is((select reclassified from public.commerce_reclassification_stats where commerce_id = (select id from tc where k = 'a')), 1::bigint, 'el comercio acumula una reclasificación');
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select reclassified from public.commerce_reclassification_stats where commerce_id = (select id from tc where k = 'a')), 1::bigint, 'coordinación sí ve la métrica de cada comercio');
reset role;
select is(tests.count_as((select id from tu where k = 'c1'), 'public.commerce_reclassification_stats'), 0::bigint, 'un cliente no ve esta métrica');

select * from finish();
rollback;
