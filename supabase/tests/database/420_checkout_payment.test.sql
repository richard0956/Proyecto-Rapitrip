begin;
select plan(54);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select k, tests.create_user(k || '@t.test') from unnest(array['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

-- Dos tiendas en el mismo punto: A (café a 150, con stock de 100) y B (pan a 20). Envío express de la zona 1: 50.
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.a', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select set_config('t.b', public.create_store((select id from tc where k = 'a'), 'Tienda B')::text, true);
select public.set_store_hours(s::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d))
  from unnest(array[current_setting('t.a'), current_setting('t.b')]) s;
select public.set_store_location(s::uuid, 12.136400, -86.251400) from unnest(array[current_setting('t.a'), current_setting('t.b')]) s;
select set_config('t.pa', public.create_product(current_setting('t.a')::uuid, 'Café')::text, true);
select set_config('t.va', public.create_variant(current_setting('t.pa')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select set_config('t.pb', public.create_product(current_setting('t.b')::uuid, 'Pan')::text, true);
select set_config('t.vb', public.create_variant(current_setting('t.pb')::uuid, 'Unidad', 'PAN-1', 20)::text, true);
select public.set_product_status(p::uuid, 'publicado') from unnest(array[current_setting('t.pa'), current_setting('t.pb')]) p;
select public.set_stock_tracking(current_setting('t.va')::uuid, true, 2);
select public.count_stock(current_setting('t.va')::uuid, 100, 'conteo inicial');
reset role;

select set_config('t.groups', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":2}]},{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]',
  current_setting('t.a'), current_setting('t.va'), current_setting('t.b'), current_setting('t.vb')), true);

-- Privilegios: solo la clave de servicio
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('record_checkout_payment_session', 'apply_stripe_checkout_event', 'claim_pending_refunds', 'record_order_checkout_session')
    and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
$$, 'ni anon ni authenticated ejecutan las funciones de pago de la compra');

-- ===== Compra 1: dos pedidos con tarjeta, se paga completa =====
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.co1', public.create_checkout(current_setting('t.groups')::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::jsonb ->> 'checkout_id', true);
select is((select payment_status from public.my_checkouts where id = current_setting('t.co1')::uuid), 'pendiente', 'una compra con tarjeta y varios pedidos queda pendiente de pago');
select is((select total from public.my_checkouts where id = current_setting('t.co1')::uuid), 420::numeric, 'total = (2 × 150 + 50) + (20 + 50)');
reset role;
select set_config('t.o1a', (select id::text from sales.orders where checkout_id = current_setting('t.co1')::uuid order by number limit 1), true);
select set_config('t.o1b', (select id::text from sales.orders where checkout_id = current_setting('t.co1')::uuid order by number desc limit 1), true);
select is((select count(*)::int from sales.orders where checkout_id = current_setting('t.co1')::uuid and status = 'pendiente_pago'), 2, 'los dos pedidos esperan el pago');

select throws_ok(format($$select public.record_order_checkout_session(%L, 'cs_test_00000001', 'nio')$$, current_setting('t.o1a')), '22023', null::text,
  'un pedido de una compra pagada de una vez no abre su propia sesión');
select throws_ok(format($$select public.record_checkout_payment_session(%L, 'sesion-mala', 'nio')$$, current_setting('t.co1')), '22023', null::text, 'la sesión debe tener el formato de Stripe');
select throws_ok($$select public.record_checkout_payment_session(gen_random_uuid(), 'cs_test_00000001', 'nio')$$, 'P0002', null::text, 'la compra debe existir');
select is((public.record_checkout_payment_session(current_setting('t.co1')::uuid, 'cs_test_00000001', 'NIO') ->> 'amount')::bigint, 42000::bigint, 'el monto esperado es la suma de los pedidos, en centavos');
select is((select payment_amount from sales.checkouts where id = current_setting('t.co1')::uuid), 42000::bigint, 'la compra guarda monto esperado');
select is((select string_agg(payment_amount::text, ',' order by number) from sales.orders where checkout_id = current_setting('t.co1')::uuid), '35000,7000', 'y cada pedido su parte');
select is((public.record_checkout_payment_session(current_setting('t.co1')::uuid, 'cs_test_00000002', 'nio') ->> 'previous_session'), 'cs_test_00000001', 'registrar otra sesión devuelve la anterior para vencerla');
select public.record_checkout_payment_session(current_setting('t.co1')::uuid, 'cs_test_00000001', 'nio');

select is(public.apply_stripe_checkout_event('evt_pay0000001', 'checkout.session.completed', current_setting('t.co1')::uuid, 'cs_test_00000001', 'pi_test_000001', 42000, 'nio', true),
  'pagado', 'el pago correcto marca la compra como pagada');
select is((select count(*)::int from sales.orders where checkout_id = current_setting('t.co1')::uuid and status = 'por_confirmar' and payment_status = 'pagado' and payment_intent_id = 'pi_test_000001'), 2,
  'los dos pedidos pasan a por confirmar con el mismo cobro');
select is((select payment_status from sales.checkouts where id = current_setting('t.co1')::uuid), 'pagado', 'la compra queda pagada');
select is(public.apply_stripe_checkout_event('evt_pay0000001', 'checkout.session.completed', current_setting('t.co1')::uuid, 'cs_test_00000001', 'pi_test_000001', 42000, 'nio', true),
  'duplicado:pagado', 'un evento repetido no se aplica dos veces');
select is(public.apply_stripe_checkout_event('evt_pay0000002', 'checkout.session.completed', current_setting('t.co1')::uuid, 'cs_test_00000001', 'pi_test_000001', 42000, 'nio', true),
  'ignorado', 'otro evento del mismo cobro se ignora');
select is(public.apply_stripe_checkout_event('evt_pay0000003', 'checkout.session.completed', current_setting('t.co1')::uuid, 'cs_test_00000001', 'pi_test_999999', 42000, 'nio', true),
  'reembolsar_doble', 'un segundo cobro distinto se reembolsa');
select is((select count(*)::int from sales.orders where checkout_id = current_setting('t.co1')::uuid and payment_intent_id = 'pi_test_000001'), 2, 'varios pedidos comparten el índice del cobro');

-- Reembolso parcial: el cliente cancela un pedido pagado y solo se devuelve su parte
select tests.authenticate_as((select id from tu where k = 'c1'));
select public.set_order_status(current_setting('t.o1b')::uuid, 'cancelado', 'ya no lo quiero');
reset role;
select is((select payment_status from sales.orders where id = current_setting('t.o1b')::uuid), 'reembolso_pendiente', 'el pedido cancelado queda en la cola de reembolsos');
select is((select payment_status from sales.orders where id = current_setting('t.o1a')::uuid), 'pagado', 'el otro sigue pagado');
select is((select amount_cents from public.claim_pending_refunds(10) where order_id = current_setting('t.o1b')::uuid), 7000::bigint, 'se reembolsa solo su parte (70.00) y no el cobro completo');
select is((select payment_intent_id from public.claim_pending_refunds(10) where order_id = current_setting('t.o1b')::uuid), 'pi_test_000001', 'sobre el mismo cobro');
select lives_ok(format($$select public.mark_order_refunded(%L, 're_test_00000001')$$, current_setting('t.o1b')), 'se marca reembolsado');
select is((select count(*)::int from public.claim_pending_refunds(10)), 0, 'la cola queda vacía');

-- ===== Compra 2: un pedido se cancela entre crear la sesión y pagar =====
select tests.authenticate_as((select id from tu where k = 'c2'));
select set_config('t.co2', public.create_checkout(current_setting('t.groups')::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::jsonb ->> 'checkout_id', true);
reset role;
select public.record_checkout_payment_session(current_setting('t.co2')::uuid, 'cs_test_00000003', 'nio');
select set_config('t.o2b', (select id::text from sales.orders where checkout_id = current_setting('t.co2')::uuid order by number desc limit 1), true);
select tests.authenticate_as((select id from tu where k = 'c2'));
select public.set_order_status(current_setting('t.o2b')::uuid, 'cancelado', 'me equivoqué');
reset role;
select is((select payment_status from sales.checkouts where id = current_setting('t.co2')::uuid), 'pendiente', 'con otro pedido pendiente la compra sigue esperando el pago');
select is(public.apply_stripe_checkout_event('evt_pay0000004', 'checkout.session.completed', current_setting('t.co2')::uuid, 'cs_test_00000003', 'pi_test_000002', 42000, 'nio', true),
  'pagado_parcial', 'el pago llega con un pedido ya cancelado: pago parcial');
select is((select payment_status from sales.orders where id = current_setting('t.o2b')::uuid), 'reembolso_pendiente', 'lo cancelado antes de llegar el pago queda para reembolso');
select is((select amount_cents from public.claim_pending_refunds(10) where order_id = current_setting('t.o2b')::uuid), 7000::bigint, 'y se devuelve solo su parte');
select is((select count(*)::int from sales.orders where checkout_id = current_setting('t.co2')::uuid and status = 'por_confirmar' and payment_status = 'pagado'), 1, 'el otro pedido sí queda pagado');

-- ===== Compra 3: la sesión vence sin pago =====
select tests.authenticate_as((select id from tu where k = 'c3'));
select set_config('t.co3', public.create_checkout(current_setting('t.groups')::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::jsonb ->> 'checkout_id', true);
reset role;
select is((select quantity from commerce.inventory where variant_id = current_setting('t.va')::uuid), 94, 'las tres compras abiertas reservaron 6 unidades de café');
select public.record_checkout_payment_session(current_setting('t.co3')::uuid, 'cs_test_00000004', 'nio');
select is(public.apply_stripe_checkout_event('evt_pay0000005', 'checkout.session.expired', current_setting('t.co3')::uuid, 'cs_test_00000004', null, null, null, false),
  'cancelado', 'una sesión vencida cancela los pedidos que esperaban pago');
select is((select count(*)::int from sales.orders where checkout_id = current_setting('t.co3')::uuid and status = 'cancelado'), 2, 'los dos pedidos quedan cancelados');
select is((select payment_status from sales.checkouts where id = current_setting('t.co3')::uuid), 'vencido', 'la compra vence');
select is((select quantity from commerce.inventory where variant_id = current_setting('t.va')::uuid), 96, 'se devolvió el stock de la compra vencida');
select is(public.apply_stripe_checkout_event('evt_pay0000006', 'checkout.session.completed', current_setting('t.co3')::uuid, 'cs_test_00000004', 'pi_test_000003', 42000, 'nio', true),
  'reembolsar_tarde', 'un pago que llega después de vencer se reembolsa completo');
select is(public.apply_stripe_checkout_event('evt_pay0000007', 'checkout.session.expired', current_setting('t.co3')::uuid, 'cs_test_00000004', null, null, null, false),
  'ignorado', 'una compra ya vencida ignora un segundo aviso de vencimiento');

-- ===== Compra 4: el monto no coincide =====
select tests.authenticate_as((select id from tu where k = 'c4'));
select set_config('t.co4', public.create_checkout(current_setting('t.groups')::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::jsonb ->> 'checkout_id', true);
reset role;
select public.record_checkout_payment_session(current_setting('t.co4')::uuid, 'cs_test_00000005', 'nio');
select is(public.apply_stripe_checkout_event('evt_pay0000008', 'checkout.session.completed', current_setting('t.co4')::uuid, 'cs_test_00000005', 'pi_test_000004', 100, 'nio', true),
  'reembolsar_monto', 'un cobro de otro monto no marca nada como pagado y se reembolsa');
select is((select count(*)::int from sales.orders where checkout_id = current_setting('t.co4')::uuid and status = 'pendiente_pago'), 2, 'los pedidos siguen esperando el pago');
select is(public.apply_stripe_checkout_event('evt_pay0000009', 'checkout.session.completed', current_setting('t.co4')::uuid, 'cs_test_00000005', 'pi_test_000004', 42000, 'nio', false),
  'ignorado', 'un aviso sin pago confirmado se ignora');

-- ===== Compra 5: el cliente cancela los dos pedidos antes de pagar =====
select tests.authenticate_as((select id from tu where k = 'c5'));
select set_config('t.co5', public.create_checkout(current_setting('t.groups')::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::jsonb ->> 'checkout_id', true);
select public.set_order_status(id, 'cancelado', 'cambié de idea') from public.orders_list where checkout_id = current_setting('t.co5')::uuid order by number limit 1;
reset role;
select is((select payment_status from sales.checkouts where id = current_setting('t.co5')::uuid), 'pendiente', 'con un pedido todavía pendiente no vence');
select tests.authenticate_as((select id from tu where k = 'c5'));
select public.set_order_status(id, 'cancelado', 'cambié de idea') from public.orders_list where checkout_id = current_setting('t.co5')::uuid and status = 'pendiente_pago';
reset role;
select is((select payment_status from sales.checkouts where id = current_setting('t.co5')::uuid), 'vencido', 'al cancelar el último pedido pendiente la compra vence');
select throws_ok(format($$select public.record_checkout_payment_session(%L, 'cs_test_00000006', 'nio')$$, current_setting('t.co5')), '22023', null::text, 'una compra vencida no abre sesión de pago');

-- ===== Un solo pedido con tarjeta se sigue pagando por pedido =====
select tests.authenticate_as((select id from tu where k = 'c6'));
select set_config('t.co6', public.create_checkout(format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.b'), current_setting('t.vb'))::jsonb,
  'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::jsonb ->> 'checkout_id', true);
reset role;
select is((select payment_status from sales.checkouts where id = current_setting('t.co6')::uuid), 'no_aplica', 'una compra de un solo pedido no necesita pago de compra');
select set_config('t.o6', (select id::text from sales.orders where checkout_id = current_setting('t.co6')::uuid), true);
select lives_ok(format($$select public.record_order_checkout_session(%L, 'cs_test_00000007', 'nio')$$, current_setting('t.o6')), 'su pedido sí abre su propia sesión');
select throws_ok(format($$select public.record_checkout_payment_session(%L, 'cs_test_00000008', 'nio')$$, current_setting('t.co6')), '22023', null::text, 'y la compra no abre una segunda');
select is(public.apply_stripe_event('evt_pay0000010', 'checkout.session.completed', current_setting('t.o6')::uuid, 'cs_test_00000007', 'pi_test_000005', 7000, 'nio', true), 'pagado', 'el pago del pedido suelto sigue funcionando');
select tests.authenticate_as((select id from tu where k = 'c6'));
select public.set_order_status(current_setting('t.o6')::uuid, 'cancelado', 'ya no lo quiero');
reset role;
select is((select amount_cents from public.claim_pending_refunds(10) where order_id = current_setting('t.o6')::uuid), null::bigint, 'su reembolso es completo (sin monto parcial)');

-- ===== Efectivo: sin pago de compra =====
select tests.authenticate_as((select id from tu where k = 'c7'));
select set_config('t.co7', public.create_checkout(current_setting('t.groups')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::jsonb ->> 'checkout_id', true);
reset role;
select is((select payment_status from sales.checkouts where id = current_setting('t.co7')::uuid), 'no_aplica', 'una compra en efectivo no tiene pago de compra');
select throws_ok(format($$select public.record_checkout_payment_session(%L, 'cs_test_00000009', 'nio')$$, current_setting('t.co7')), '22023', null::text, 'ni sesión de Stripe');

-- Auditoría
select ok(exists (select 1 from audit.events where action = 'checkout.payment_session_created'), 'la sesión de pago de la compra queda auditada');
select ok(exists (select 1 from audit.events where action = 'checkout.payment_expired'), 'el vencimiento queda auditado');
select ok(exists (select 1 from audit.events where action = 'checkout.payment_refund_needed' and after_data ->> 'reason' = 'reembolsar_tarde'), 'y los reembolsos completos pendientes');
select ok(exists (select 1 from sales.payment_events where event_id = 'evt_pay0000001' and outcome = 'pagado'), 'el evento queda registrado con su resultado');
select is((select for_checkout from public.payment_events_list where event_id = 'evt_pay0000006'), true, 'la pantalla de excepciones distingue un cobro de compra por reembolsar');

select * from finish();
rollback;
