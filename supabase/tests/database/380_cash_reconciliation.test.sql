begin;
select plan(37);

-- Esquema: referencias de pago, recepción de efectivo e incidencias de caja
select has_column('sales', 'orders', 'payment_ref', 'los pedidos guardan su referencia de pago');
select has_column('sales', 'orders', 'cash_received_at', 'los pedidos guardan cuándo el cajero recibió el efectivo');
select has_table('sales', 'cash_session_incidents', 'las incidencias de caja tienen tabla propia');
select has_column('public', 'orders_list', 'payment_ref', 'la lista de pedidos muestra el código de cobro');

-- Pagos web con tarjeta: el turno abierto cuando la pasarela confirma el pago
create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'caj', tests.create_user('caj@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_location(current_setting('t.store')::uuid, 12.136400, -86.251400);
select public.set_store_hours(current_setting('t.store')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prod', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":2}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

select tests.authenticate_as((select id from tu where k = 'caj'));
select set_config('t.s1', public.open_cash_session(500)::text, true);
reset role;

-- La pasarela confirma el pago mientras el cajero tiene su turno abierto
select public.mark_order_paid(current_setting('t.o1')::uuid);
select is((select cash_session_id::text from sales.orders where id = current_setting('t.o1')::uuid), current_setting('t.s1'),
  'un pago web confirmado entra al turno abierto');
select throws_ok(format($$select public.mark_order_paid(%L)$$, current_setting('t.o1')), '22023', null::text,
  'un pago web no se confirma dos veces');

-- Sin turno abierto, el pago queda pendiente de asignar y el siguiente turno lo recoge
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o2', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'caj'));
select public.close_cash_session(500, null);
reset role;
select public.mark_order_paid(current_setting('t.o2')::uuid);
select is((select cash_session_id from sales.orders where id = current_setting('t.o2')::uuid), null::uuid,
  'sin turno abierto el pago queda pendiente de asignar');
select tests.authenticate_as((select id from tu where k = 'caj'));
select set_config('t.s2', public.open_cash_session(500)::text, true);
reset role;
select is((select cash_session_id::text from sales.orders where id = current_setting('t.o2')::uuid), current_setting('t.s2'),
  'el siguiente turno recoge el pago pendiente');
select is((select cash_session_id::text from sales.orders where id = current_setting('t.o1')::uuid), current_setting('t.s1'),
  'el pago que ya estaba en un turno cerrado no se mueve');

-- Efectivo del repartidor: lo registra al entregar y el cajero lo recibe en su turno abierto
insert into identity.couriers (full_name, phone, vehicle_type, created_by)
  values ('Repartidor de prueba', '88880000', 'moto', null);
select set_config('t.courier', (select id::text from identity.couriers where full_name = 'Repartidor de prueba'), true);
insert into tu select 'coo', tests.create_user('coo@t.test');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.oc', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.oc')::uuid, 'confirmado');
select public.set_order_status(current_setting('t.oc')::uuid, 'preparando');
select public.set_order_status(current_setting('t.oc')::uuid, 'listo');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(current_setting('t.oc')::uuid, current_setting('t.courier')::uuid);
select public.set_order_status(current_setting('t.oc')::uuid, 'en_camino');
select throws_ok(format($$select public.register_courier_cash(%L)$$, current_setting('t.oc')), '22023', null::text,
  'el efectivo no se registra antes de entregar el pedido');
select public.set_order_status(current_setting('t.oc')::uuid, 'entregado');
select lives_ok(format($$select set_config('t.code', public.register_courier_cash(%L), true)$$, current_setting('t.oc')),
  'el repartidor registra el efectivo al entregar');
select is(left(current_setting('t.code'), 3), 'CE-', 'el código de cobro empieza con CE-');
select is(length(current_setting('t.code')), 9, 'el código de cobro tiene 9 caracteres');
select throws_ok(format($$select public.register_courier_cash(%L)$$, current_setting('t.oc')), '23505', null::text,
  'el mismo efectivo no se registra dos veces');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.register_courier_cash(%L)$$, current_setting('t.oc')), '42501', null::text,
  'el cliente no registra efectivo de repartidor');
reset role;

select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.receive_courier_cash(%L)$$, current_setting('t.oc')), '42501', null::text,
  'solo el cajero recibe el efectivo físico');
reset role;
select tests.authenticate_as((select id from tu where k = 'caj'));
select lives_ok(format($$select public.receive_courier_cash(%L)$$, current_setting('t.oc')), 'el cajero recibe el efectivo del repartidor');
reset role;
select is((select cash_received_session::text from sales.orders where id = current_setting('t.oc')::uuid), current_setting('t.s2'),
  'el efectivo recibido queda en el turno abierto del cajero');
select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.receive_courier_cash(%L)$$, current_setting('t.oc')), '23505', null::text,
  'el mismo efectivo no se recibe dos veces');
reset role;

-- Apertura con el efectivo del cierre anterior y ventas de mostrador con voucher
select tests.authenticate_as((select id from tu where k = 'caj'));
select is((select public.close_cash_session(480, 'faltan 220 del efectivo recibido') ->> 'difference'), '-220.00', 'el cierre guarda la diferencia con su nota');
select throws_ok($$select public.open_cash_session(999)$$, '22023', null::text, 'el siguiente turno no acepta otro monto que el del cierre anterior');
select lives_ok($$select set_config('t.s3', public.open_cash_session(null)::text, true)$$, 'el siguiente turno se abre sin escribir el monto');
select is((select opening_amount::text from sales.cash_sessions where id = current_setting('t.s3')::uuid), '480.00',
  'el saldo inicial es el efectivo contado en el cierre anterior');
select throws_ok(format($$select public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'tarjeta')$$, current_setting('t.store'), current_setting('t.var')),
  '22023', null::text, 'una venta con tarjeta de mostrador pide el voucher');
select lives_ok(format($$select set_config('t.ov1', public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'tarjeta', 'VCH1')::text, true)$$,
  current_setting('t.store'), current_setting('t.var')), 'una venta con tarjeta guarda su voucher');
select throws_ok(format($$select public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'tarjeta', 'VCH1')$$, current_setting('t.store'), current_setting('t.var')),
  '23505', null::text, 'el mismo voucher no se usa dos veces en la misma tienda');
select lives_ok(format($$select set_config('t.oe1', public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'efectivo')::text, true)$$,
  current_setting('t.store'), current_setting('t.var')), 'una venta en efectivo se registra');
select is((select left(payment_ref, 3) from sales.orders where id = current_setting('t.oe1')::uuid), 'CE-', 'la venta en efectivo guarda su código de cobro');
reset role;

-- Arqueo y cierre: producto con control de stock, un efectivo de repartidor no recibido y el cierre con incidencias
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.pan', public.create_product(current_setting('t.store')::uuid, 'Pan')::text, true);
select set_config('t.varpan', public.create_variant(current_setting('t.pan')::uuid, 'Unidad', 'PAN-1', 80)::text, true);
select public.set_product_status(current_setting('t.pan')::uuid, 'publicado');
select public.set_stock_tracking(current_setting('t.varpan')::uuid, true, 2);
select public.count_stock(current_setting('t.varpan')::uuid, 10, 'conteo inicial');
reset role;

select tests.authenticate_as((select id from tu where k = 'caj'));
select public.create_counter_sale(current_setting('t.store')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.varpan'))::jsonb, 'efectivo');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o4', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.o4')::uuid, 'confirmado');
select public.set_order_status(current_setting('t.o4')::uuid, 'preparando');
select public.set_order_status(current_setting('t.o4')::uuid, 'listo');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(current_setting('t.o4')::uuid, current_setting('t.courier')::uuid);
select public.set_order_status(current_setting('t.o4')::uuid, 'en_camino');
select public.set_order_status(current_setting('t.o4')::uuid, 'entregado');
select public.register_courier_cash(current_setting('t.o4')::uuid);
reset role;

select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok('select public.close_cash_session(710, null)', '22023', null::text,
  'con incidencias el cierre pide la nota');
select lives_ok('select public.close_cash_session(710, ''el efectivo del repartidor sigue pendiente'')', 'el cierre con incidencias se guarda con su nota');
reset role;
select is((private.cash_breakdown(current_setting('t.s3')::uuid) ->> 'efectivo_mostrador')::numeric, 230::numeric, 'el arqueo suma el efectivo de mostrador del turno');
select is((private.cash_breakdown(current_setting('t.s3')::uuid) ->> 'tarjeta_mostrador')::numeric, 150::numeric, 'el arqueo suma la tarjeta de mostrador del turno');
select is((select count(*)::int from sales.cash_session_incidents where session_id = current_setting('t.s3')::uuid and kind = 'efectivo_no_recibido'), 1,
  'el efectivo del repartidor no recibido queda como incidencia');
select is((select count(*)::int from sales.cash_session_incidents where session_id = current_setting('t.s3')::uuid
             and kind in ('sin_movimiento_stock', 'movimiento_sin_venta', 'descuadre_stock')), 0,
  'una venta con control de stock no genera incidencias de inventario');

-- Pantalla de caja: efectivo de repartidor pendiente e incidencias del turno, solo para el cajero y la administración
select tests.authenticate_as((select id from tu where k = 'caj'));
select is((select count(*)::int from public.pending_courier_cash() where order_id = current_setting('t.o4')::uuid), 1,
  'el efectivo del repartidor pendiente de recibir aparece en caja');
select is((select count(*)::int from public.cash_session_incidents_for(current_setting('t.s3')::uuid) where kind = 'efectivo_no_recibido'), 1,
  'el cajero ve las incidencias de su turno');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok($$select * from public.pending_courier_cash()$$, '42501', null::text, 'el cliente no ve el efectivo pendiente');
reset role;

select * from finish();
rollback;
