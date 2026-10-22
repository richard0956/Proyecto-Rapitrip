begin;
select plan(41);

-- Usuarios y tienda
create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'caj', tests.create_user('caj390@t.test');
insert into tu select 'com', tests.create_user('com390@t.test');
insert into tu select 'coo', tests.create_user('coo390@t.test');
insert into tu select 'cli', tests.create_user('cli390@t.test');
insert into tu select 'otro', tests.create_user('otro390@t.test');
insert into tu select 'adm', tests.create_user('adm390@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio 390');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
insert into identity.couriers (full_name, phone, vehicle_type, created_by)
  values ('Repartidor 390', '88880390', 'moto', null);
select set_config('t.courier', (select id::text from identity.couriers where full_name = 'Repartidor 390'), true);

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda 390')::text, true);
select public.set_store_location(current_setting('t.store')::uuid, 12.136400, -86.251400);
select public.set_store_hours(current_setting('t.store')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prod', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-390', 100)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');
reset role;

-- Turno abierto de Rapitrip
select tests.authenticate_as((select id from tu where k = 'caj'));
select set_config('t.s1', public.open_cash_session(500)::text, true);
reset role;

-- Pedido con tarjeta pagado y entregado (P)
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.p', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select public.mark_order_paid(current_setting('t.p')::uuid);
update sales.orders set payment_intent_id = 'pi_test_p390' where id = current_setting('t.p')::uuid;

-- Pedido en efectivo entregado y recibido por el cajero (B)
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.b', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

-- Pedido en efectivo entregado y no recibido (E)
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.e', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.f', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.c', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'otro'));
select set_config('t.d', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

-- Anulación en efectivo antes de entregar: el cliente cancela F y no mueve dinero
select tests.authenticate_as((select id from tu where k = 'cli'));
select lives_ok(format($$select public.set_order_status(%L, 'cancelado', 'cambié de opinión')$$, current_setting('t.f')), 'el cliente anula un pedido en efectivo antes de entregarlo');
reset role;
select is((select payment_ref from sales.orders where id = current_setting('t.f')::uuid), null::text, 'una anulación en efectivo no genera código de cobro');

-- Anulación de tarjeta sin pago confirmado: C no pasó a pagado, no hay reembolso
select tests.authenticate_as((select id from tu where k = 'cli'));
select lives_ok(format($$select public.set_order_status(%L, 'cancelado', 'pago no completado')$$, current_setting('t.c')), 'el cliente anula un pedido con tarjeta sin pago confirmado');
reset role;
select is((select payment_status from sales.orders where id = current_setting('t.c')::uuid), 'pendiente', 'sin pago confirmado no hay reembolso');

-- Reembolso: D tiene pago confirmado y el comercio lo cancela antes de completarse
select tests.authenticate_as((select id from tu where k = 'cli'));
reset role;
select public.mark_order_paid(current_setting('t.d')::uuid);
update sales.orders set payment_intent_id = 'pi_test_d390' where id = current_setting('t.d')::uuid;
select tests.authenticate_as((select id from tu where k = 'com'));
select lives_ok(format($$select public.set_order_status(%L, 'cancelado', 'sin existencias')$$, current_setting('t.d')), 'el comercio cancela un pedido ya pagado');
reset role;
select is((select payment_status from sales.orders where id = current_setting('t.d')::uuid), 'reembolso_pendiente', 'cancelar un pedido pagado lo manda a reembolso');

-- Completar B, P y E hasta entregado
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.b')::uuid, 'confirmado');
select public.set_order_status(current_setting('t.b')::uuid, 'preparando');
select public.set_order_status(current_setting('t.b')::uuid, 'listo');
select public.set_order_status(current_setting('t.e')::uuid, 'confirmado');
select public.set_order_status(current_setting('t.e')::uuid, 'preparando');
select public.set_order_status(current_setting('t.e')::uuid, 'listo');
select public.set_order_status(current_setting('t.p')::uuid, 'confirmado');
select public.set_order_status(current_setting('t.p')::uuid, 'preparando');
select public.set_order_status(current_setting('t.p')::uuid, 'listo');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(current_setting('t.b')::uuid, current_setting('t.courier')::uuid);
select public.assign_order_courier(current_setting('t.e')::uuid, current_setting('t.courier')::uuid);
select public.assign_order_courier(current_setting('t.p')::uuid, current_setting('t.courier')::uuid);
select public.set_order_status(current_setting('t.b')::uuid, 'en_camino');
select public.set_order_status(current_setting('t.e')::uuid, 'en_camino');
select public.set_order_status(current_setting('t.p')::uuid, 'en_camino');
select public.set_order_status(current_setting('t.b')::uuid, 'entregado');
select public.set_order_status(current_setting('t.e')::uuid, 'entregado');
select public.set_order_status(current_setting('t.p')::uuid, 'entregado');
select public.register_courier_cash(current_setting('t.b')::uuid);
select public.register_courier_cash(current_setting('t.e')::uuid);
reset role;
select tests.authenticate_as((select id from tu where k = 'caj'));
select public.receive_courier_cash(current_setting('t.b')::uuid);
reset role;

-- Devoluciones: solo el cliente, con fotos de su carpeta, dentro de 3 días
select set_config('t.ph', (select id::text from tu where k = 'cli') || '/', true);
select tests.authenticate_as((select id from tu where k = 'otro'));
select throws_ok(format($$select public.request_return(%L, 'no es mío', array[%L])$$, current_setting('t.b'), current_setting('t.ph') || 'foto1.jpg'), '42501', null::text,
  'otro cliente no pide la devolución de un pedido ajeno');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.request_return(%L, 'pedido cancelado', array[%L])$$, current_setting('t.c'), current_setting('t.ph') || 'foto1.jpg'), '22023', null::text,
  'solo se devuelven pedidos entregados');
select throws_ok(format($$select public.request_return(%L, 'producto dañado', array[]::text[])$$, current_setting('t.b')), '22023', null::text,
  'la devolución pide al menos una foto');
select lives_ok(format($$select set_config('t.rb', public.request_return(%L, 'producto dañado al abrir', array[%L,%L])::text, true)$$, current_setting('t.b'), current_setting('t.ph') || 'foto1.jpg', current_setting('t.ph') || 'foto2.jpg'),
  'el cliente pide la devolución con fotos dentro de 3 días');
select throws_ok(format($$select public.request_return(%L, 'otra vez', array[%L])$$, current_setting('t.b'), current_setting('t.ph') || 'foto1.jpg'), '23505', null::text,
  'un pedido tiene una sola solicitud de devolución');
reset role;
update sales.orders set delivered_at = now() - interval '4 days' where id = current_setting('t.e')::uuid;
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.request_return(%L, 'foto de otra cuenta', array[%L])$$, current_setting('t.e'), (select id::text from tu where k = 'otro') || '/ajena.jpg'), '22023', null::text,
  'las fotos se suben solo a la cuenta del cliente');
select throws_ok(format($$select public.request_return(%L, 'llegó roto', array[%L])$$, current_setting('t.e'), current_setting('t.ph') || 'foto1.jpg'), '22023', null::text,
  'pasados 3 días no se pide devolución');
reset role;
update sales.orders set delivered_at = now() where id = current_setting('t.e')::uuid;

-- Decisión: solo coordinación, con nota
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.decide_return(%L, 'aprobada', 'lo decido yo')$$, current_setting('t.rb')), '42501', null::text,
  'el cliente no decide su propia devolución');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.decide_return(%L, 'aprobada', 'coordinación no decide')$$, current_setting('t.rb')), '42501', null::text,
  'coordinación no decide las devoluciones');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.decide_return(%L, 'aprobada', '')$$, current_setting('t.rb')), '22023', null::text,
  'la decisión lleva una nota');
select lives_ok(format($$select public.decide_return(%L, 'aprobada', 'fotos muestran daño en el empaque')$$, current_setting('t.rb')),
  'coordinación aprueba la devolución con su nota');
select throws_ok(format($$select public.decide_return(%L, 'rechazada', 'cambio de opinión')$$, current_setting('t.rb')), '22023', null::text,
  'una devolución con decisión no se decide otra vez');
reset role;

-- Efectivo: el cajero devuelve el efectivo de B y sale de su turno
select tests.authenticate_as((select id from tu where k = 'caj'));
select is((select count(*)::int from public.pending_cash_returns() where request_id = current_setting('t.rb')::uuid), 1,
  'la caja ve el efectivo pendiente de devolver');
reset role;
select tests.authenticate_as((select id from tu where k = 'caj'));
select lives_ok(format($$select public.return_cash_to_customer(%L)$$, current_setting('t.rb')), 'el cajero devuelve el efectivo de una devolución aprobada');
select is((select count(*)::int from public.pending_cash_returns() where request_id = current_setting('t.rb')::uuid), 0,
  'una vez devuelto, el efectivo ya no está pendiente');
select throws_ok(format($$select public.return_cash_to_customer(%L)$$, current_setting('t.rb')), '23505', null::text,
  'el mismo efectivo no se devuelve dos veces');
reset role;
select is((private.cash_breakdown(current_setting('t.s1')::uuid) ->> 'efectivo_devuelto')::numeric,
  (select total from sales.orders where id = current_setting('t.b')::uuid), 'el turno registra el efectivo devuelto');
select is(private.expected_cash(current_setting('t.s1')::uuid), 500::numeric,
  'el efectivo recibido y luego devuelto no cambia lo esperado en caja');

-- Devolución rechazada en efectivo: E no sale de caja
select tests.authenticate_as((select id from tu where k = 'cli'));
select lives_ok(format($$select set_config('t.re', public.request_return(%L, 'no era lo que pedí', array[%L])::text, true)$$, current_setting('t.e'), current_setting('t.ph') || 'foto1.jpg'),
  'el cliente pide devolución de un pedido en efectivo');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.decide_return(%L, 'rechazada', 'el producto está en condiciones')$$, current_setting('t.re')),
  'coordinación rechaza la devolución con nota');
reset role;
select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.return_cash_to_customer(%L)$$, current_setting('t.re')), '22023', null::text,
  'una devolución rechazada no devuelve efectivo');
reset role;

-- Devolución aprobada con tarjeta: P pasa a reembolso y Stripe lo confirma en el turno abierto
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.rp', public.request_return(current_setting('t.p')::uuid, 'llegó con el empaque abierto', array[current_setting('t.ph') || 'foto1.jpg'])::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.decide_return(current_setting('t.rp')::uuid, 'aprobada', 'empaque abierto confirmado en fotos');
reset role;
select is((select payment_status from sales.orders where id = current_setting('t.p')::uuid), 'reembolso_pendiente', 'una devolución aprobada con tarjeta entra a la cola de reembolso');
select is((select count(*)::int from public.claim_pending_refunds(50) where order_id in (current_setting('t.p')::uuid, current_setting('t.d')::uuid)), 2,
  'P y D esperan su reembolso en Stripe');
select public.mark_order_refunded(current_setting('t.p')::uuid, 're_test390pppp');
select public.mark_order_refunded(current_setting('t.d')::uuid, 're_test390dddd');
select is((select refund_session_id::text from sales.orders where id = current_setting('t.p')::uuid), current_setting('t.s1'),
  'el reembolso confirmado cuenta en el turno abierto');
select is((private.cash_breakdown(current_setting('t.s1')::uuid) ->> 'reembolsos_tarjeta')::numeric,
  (select total from sales.orders where id = current_setting('t.p')::uuid) + (select total from sales.orders where id = current_setting('t.d')::uuid),
  'el turno suma los reembolsos con tarjeta');
select is((private.cash_breakdown(current_setting('t.s1')::uuid) ->> 'tarjeta_web')::numeric,
  (select total from sales.orders where id = current_setting('t.p')::uuid) + (select total from sales.orders where id = current_setting('t.d')::uuid),
  'el pago con tarjeta se cuenta en el turno donde se cobró, aunque luego se reembolse');
select is((select payment_status from sales.orders where id = current_setting('t.c')::uuid), 'pendiente', 'la anulación sin pago no toca el turno');

select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select count(*)::int from public.return_requests_for_admin() where request_id = current_setting('t.rb')::uuid), 1,
  'administración ve las solicitudes con sus fotos');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok($$select * from public.return_requests_for_admin()$$, '42501', null::text, 'el cliente no ve la lista de devoluciones');
reset role;

-- Efectivo que el cajero aún no recibió no se devuelve al cliente
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.g', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.g')::uuid, 'confirmado');
select public.set_order_status(current_setting('t.g')::uuid, 'preparando');
select public.set_order_status(current_setting('t.g')::uuid, 'listo');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(current_setting('t.g')::uuid, current_setting('t.courier')::uuid);
select public.set_order_status(current_setting('t.g')::uuid, 'en_camino');
select public.set_order_status(current_setting('t.g')::uuid, 'entregado');
select public.register_courier_cash(current_setting('t.g')::uuid);
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.rg', public.request_return(current_setting('t.g')::uuid, 'no era lo que pedí', array[(select id::text from tu where k = 'cli') || '/foto1.jpg'])::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.decide_return(current_setting('t.rg')::uuid, 'aprobada', 'devolución aprobada para la prueba');
reset role;
select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.return_cash_to_customer(%L)$$, current_setting('t.rg')), '22023', null::text,
  'no se devuelve efectivo que el cajero todavía no recibió');
select is((select count(*)::int from public.pending_cash_returns() where request_id = current_setting('t.rg')::uuid), 0,
  'la caja no lista esa devolución hasta recibir el efectivo');
reset role;

-- Lo que ve el cajero: el efectivo esperado incluye lo recibido de repartidores y descuenta lo devuelto
select tests.authenticate_as((select id from tu where k = 'caj'));
select is((select cash_expected from public.cash_sessions_list where id = current_setting('t.s1')::uuid), 500::numeric,
  'el cajero ve el efectivo esperado con lo recibido y lo devuelto');
reset role;

-- El cliente ve el estado de su devolución; otro usuario no ve nada
select tests.authenticate_as((select id from tu where k = 'cli'));
select is((select status from public.my_return_request(current_setting('t.b')::uuid)), 'aprobada',
  'el cliente ve el estado de su devolución en la app');
select is((select decision_note from public.my_return_request(current_setting('t.b')::uuid)), 'fotos muestran daño en el empaque',
  'el cliente ve la nota de la decisión');
reset role;
select tests.authenticate_as((select id from tu where k = 'otro'));
select is((select count(*)::int from public.my_return_request(current_setting('t.b')::uuid)), 0,
  'otro cliente no ve la devolución ajena');
reset role;

select * from finish();
rollback;
