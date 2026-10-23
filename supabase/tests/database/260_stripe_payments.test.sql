begin;
select plan(40);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

-- Tienda abierta todo el día con una variante de stock controlado (10 unidades) a 150.00.
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_location(current_setting('t.store')::uuid, 12.136400, -86.251400);
select public.set_store_hours(current_setting('t.store')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prod', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');
select public.set_stock_tracking(current_setting('t.var')::uuid, true, 2);
select public.count_stock(current_setting('t.var')::uuid, 10, 'conteo inicial');
reset role;

-- Privilegios: solo la clave de servicio
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('record_order_checkout_session', 'apply_stripe_event', 'set_payment_event_outcome', 'claim_pending_refunds', 'mark_order_refunded')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
$$, 'ni anon ni authenticated ejecutan las funciones de pagos');
select ok(has_function_privilege('service_role', 'public.apply_stripe_event(text, text, uuid, text, text, bigint, text, boolean)', 'execute'),
  'la clave de servicio sí ejecuta apply_stripe_event');

-- Pedido con tarjeta: 2 × 150 + 50 de envío de la zona 1 = 350.00
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":2}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.cash', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select is((select status from sales.orders where id = current_setting('t.o1')::uuid), 'pendiente_pago', 'el pedido con tarjeta espera el pago');

-- Registrar la sesión de pago
select throws_ok(format($$select public.record_order_checkout_session(%L, 'no-es-sesion', 'nio')$$, current_setting('t.o1')), '22023', null::text, 'rechaza una sesión inválida');
select throws_ok(format($$select public.record_order_checkout_session(%L, 'cs_test_efectivo0001', 'nio')$$, current_setting('t.cash')), '22023', null::text, 'un pedido en efectivo no admite sesión de pago');
select is((select public.record_order_checkout_session(current_setting('t.o1')::uuid, 'cs_test_sesion00001', 'NIO') ->> 'amount'), '35000', 'registra la sesión con el monto en centavos');
select is((select payment_currency from sales.orders where id = current_setting('t.o1')::uuid), 'nio', 'la moneda se guarda en minúsculas');
select is((select public.record_order_checkout_session(current_setting('t.o1')::uuid, 'cs_test_sesion00002', 'nio') ->> 'previous_session'), 'cs_test_sesion00001',
  'una sesión nueva devuelve la anterior para vencerla');

-- Pagos: monto distinto, correcto, duplicado, doble
select is(public.apply_stripe_event('evt_test_monto0001', 'checkout.session.completed', current_setting('t.o1')::uuid, 'cs_test_sesion00002', 'pi_test_intent0001', 34999, 'nio', true),
  'reembolsar_monto', 'un monto distinto se manda a reembolsar');
select is((select status from sales.orders where id = current_setting('t.o1')::uuid), 'pendiente_pago', 'el pedido sigue sin pagar tras un monto incorrecto');
select is(public.apply_stripe_event('evt_test_moneda001', 'checkout.session.completed', current_setting('t.o1')::uuid, 'cs_test_sesion00002', 'pi_test_intent0002', 35000, 'usd', true),
  'reembolsar_monto', 'una moneda distinta también se manda a reembolsar');
select is(public.apply_stripe_event('evt_test_asinc00001', 'checkout.session.completed', current_setting('t.o1')::uuid, 'cs_test_sesion00002', 'pi_test_intent0003', 35000, 'nio', false),
  'ignorado', 'un pago aún no confirmado no marca el pedido');
select is(public.apply_stripe_event('evt_test_pagado0001', 'checkout.session.completed', current_setting('t.o1')::uuid, 'cs_test_sesion00002', 'pi_test_intent0004', 35000, 'nio', true),
  'pagado', 'el pago correcto marca el pedido');
select is((select status || '/' || payment_status from sales.orders where id = current_setting('t.o1')::uuid), 'por_confirmar/pagado', 'el pedido pasa a por confirmar y pagado');
select is((select payment_intent_id from sales.orders where id = current_setting('t.o1')::uuid), 'pi_test_intent0004', 'queda guardado el pago de Stripe');
select is(public.apply_stripe_event('evt_test_pagado0001', 'checkout.session.completed', current_setting('t.o1')::uuid, 'cs_test_sesion00002', 'pi_test_intent0004', 35000, 'nio', true),
  'duplicado:pagado', 'el mismo evento no se procesa dos veces');
select is(public.apply_stripe_event('evt_test_reenvio001', 'checkout.session.completed', current_setting('t.o1')::uuid, 'cs_test_sesion00002', 'pi_test_intent0004', 35000, 'nio', true),
  'ignorado', 'otro evento del mismo pago no se cobra ni se reembolsa');
select is(public.apply_stripe_event('evt_test_doble00001', 'checkout.session.completed', current_setting('t.o1')::uuid, 'cs_test_sesion00001', 'pi_test_intent0005', 35000, 'nio', true),
  'reembolsar_doble', 'un segundo pago distinto del mismo pedido se manda a reembolsar');
select lives_ok($$select public.set_payment_event_outcome('evt_test_doble00001', 'reembolsado_doble')$$, 'se deja constancia del reembolso');
select is(public.apply_stripe_event('evt_test_doble00001', 'checkout.session.completed', current_setting('t.o1')::uuid, 'cs_test_sesion00001', 'pi_test_intent0005', 35000, 'nio', true),
  'duplicado:reembolsado_doble', 'reintentar un evento ya reembolsado lo reconoce');
select throws_ok($$select public.set_payment_event_outcome('evt_test_doble00001', 'reembolsado_doble')$$, '22023', null::text,
  'no se puede marcar dos veces un reembolso');

-- Cancelar un pedido pagado con tarjeta lo deja en cola de reembolso y devuelve el stock
select tests.authenticate_as((select id from tu where k = 'cli'));
select lives_ok(format($$select public.set_order_status(%L, 'cancelado', 'ya no lo necesito')$$, current_setting('t.o1')), 'el cliente cancela su pedido pagado');
reset role;
select is((select payment_status from sales.orders where id = current_setting('t.o1')::uuid), 'reembolso_pendiente', 'un pedido pagado y cancelado queda pendiente de reembolso');
select is((select count(*)::int from public.claim_pending_refunds(10) where order_id = current_setting('t.o1')::uuid and payment_intent_id = 'pi_test_intent0004'), 1,
  'la cola de reembolsos trae el pedido con su pago');
select throws_ok(format($$select public.mark_order_refunded(%L, 'malo')$$, current_setting('t.o1')), '22023', null::text, 'valida el identificador del reembolso');
select lives_ok(format($$select public.mark_order_refunded(%L, 're_test_reembolso001')$$, current_setting('t.o1')), 'se marca el pedido como reembolsado');
select is((select payment_status from sales.orders where id = current_setting('t.o1')::uuid), 'reembolsado', 'el pedido queda reembolsado');
select throws_ok(format($$select public.mark_order_refunded(%L, 're_test_reembolso002')$$, current_setting('t.o1')), '22023', null::text, 'no se reembolsa dos veces');
select is((select count(*)::int from public.claim_pending_refunds(10) where order_id = current_setting('t.o1')::uuid), 0, 'ya no está en la cola');

-- Un pedido en efectivo cancelado no genera reembolso
select tests.authenticate_as((select id from tu where k = 'cli'));
select public.set_order_status(current_setting('t.cash')::uuid, 'cancelado', 'cambié de opinión');
reset role;
select is((select payment_status from sales.orders where id = current_setting('t.cash')::uuid), 'pendiente', 'cancelar un pedido en efectivo no pide reembolso');

-- El comercio rechaza un pedido ya pagado: también va a reembolso
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o2', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select public.record_order_checkout_session(current_setting('t.o2')::uuid, 'cs_test_sesion00003', 'nio');
select is(public.apply_stripe_event('evt_test_pagado0002', 'checkout.session.completed', current_setting('t.o2')::uuid, 'cs_test_sesion00003', 'pi_test_intent0006', 20000, 'nio', true),
  'pagado', 'segundo pedido pagado');
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.o2')::uuid, 'rechazado', 'sin existencias reales');
reset role;
select is((select payment_status from sales.orders where id = current_setting('t.o2')::uuid), 'reembolso_pendiente', 'rechazar un pedido pagado lo manda a reembolso');

-- Sesión vencida: cancela el pedido y libera el stock; una sesión que ya no es la vigente se ignora
select is((select quantity from commerce.inventory where variant_id = current_setting('t.var')::uuid), 10, 'tras cancelar y rechazar los pedidos anteriores, el stock está completo');
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o3', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":3}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select public.record_order_checkout_session(current_setting('t.o3')::uuid, 'cs_test_sesion00004', 'nio');
select is((select quantity from commerce.inventory where variant_id = current_setting('t.var')::uuid), 7, 'el pedido sin pagar reservó 3');
select is(public.apply_stripe_event('evt_test_vence00001', 'checkout.session.expired', current_setting('t.o3')::uuid, 'cs_test_vieja0001', null, null, null, false),
  'ignorado', 'el vencimiento de una sesión anterior no cancela el pedido');
select is(public.apply_stripe_event('evt_test_vence00002', 'checkout.session.expired', current_setting('t.o3')::uuid, 'cs_test_sesion00004', null, null, null, false),
  'cancelado', 'el vencimiento de la sesión vigente cancela el pedido');
select is((select quantity from commerce.inventory where variant_id = current_setting('t.var')::uuid), 10, 'al cancelarse por falta de pago se devuelve el stock reservado');

-- Pago tarde: llega después de cancelado el pedido
select is(public.apply_stripe_event('evt_test_tarde00001', 'checkout.session.completed', current_setting('t.o3')::uuid, 'cs_test_sesion00004', 'pi_test_intent0007', 50000, 'nio', true),
  'reembolsar_tarde', 'un pago que llega con el pedido ya cancelado se manda a reembolsar');
select is(public.apply_stripe_event('evt_test_nopedido01', 'checkout.session.completed', gen_random_uuid(), 'cs_test_sesion00009', 'pi_test_intent0008', 100, 'nio', true),
  'ignorado', 'un evento de un pedido que no existe se ignora');
select throws_ok($$select public.apply_stripe_event('malo', 'checkout.session.completed', gen_random_uuid(), null, null, null, null, false)$$, '22023', null::text, 'valida el identificador del evento');

select * from finish();
rollback;
