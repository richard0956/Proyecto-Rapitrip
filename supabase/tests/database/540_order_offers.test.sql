begin;
select plan(47);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select k, tests.create_user(k || '@t.test', 'Rep ' || k) from unnest(array['ra', 'rb', 'rc', 'rd', 're']) k;
insert into tu select 'c1', tests.create_user('c1@t.test', 'Cliente Uno');
insert into tu select 'c2', tests.create_user('c2@t.test', 'Cliente Dos');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role(id, 'repartidor') from tu where k in ('ra', 'rb', 'rc', 'rd', 're');

-- Tienda en Managua: café (express) y sillón (programado).
reset role;
insert into sales.programmed_bands (band, up_to_km, min_days, max_days, courier_pay, margin) values (1, 50, 1, 3, 100, 20);
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
select public.set_product_delivery(current_setting('t.ps')::uuid, false, 40, 90, 80, 85, 0);
reset role;

update commerce.stores set address = 'Km 5 Carretera Norte, local 3' where id = current_setting('t.s')::uuid;

-- Repartidores: A, B, D y E con cuenta y moto en Managua; C sin cuenta. B no está disponible; D se desactivará.
select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.c' || k, public.create_courier('Rep ' || k, '8888000' || n, 'moto')::text, true)
  from unnest(array['a', 'b', 'c', 'd', 'e'], array[1, 2, 3, 4, 5]) as x(k, n);
select public.set_courier_coverage(current_setting('t.c' || k)::uuid, 'moto', 'managua') from unnest(array['a', 'b', 'c', 'd', 'e']) k;
reset role;
update identity.couriers c set user_id = (select id from tu where tu.k = 'r' || x.k)
  from (values ('a'), ('b'), ('d'), ('e')) x(k) where c.id = current_setting('t.c' || x.k)::uuid;
update identity.couriers set available = true, available_since = now()
 where id in (current_setting('t.ca')::uuid, current_setting('t.cd')::uuid, current_setting('t.ce')::uuid);

select set_config('t.cart', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vc')), true);
select set_config('t.cartp', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vs')), true);

-- Pedidos: o1..o5 express y p1 programado, todos en efectivo.
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.k' || n, public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true)
  from generate_series(1, 3) n;
select set_config('t.kp', public.create_checkout(current_setting('t.cartp')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true);
reset role;
select tests.authenticate_as((select id from tu where k = 'c2'));
select set_config('t.k' || n, public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Colonia Nueva', '88882222', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true)
  from generate_series(4, 5) n;
reset role;
select set_config('t.o' || n, (select id::text from sales.orders where checkout_id = current_setting('t.k' || n)::uuid), true) from generate_series(1, 5) n;
select set_config('t.p1', (select id::text from sales.orders where checkout_id = current_setting('t.kp')::uuid), true);

select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(o::uuid, 'confirmado') from unnest(array[current_setting('t.o1'), current_setting('t.o2'), current_setting('t.o3'), current_setting('t.o4'), current_setting('t.o5')]) o;
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.set_order_status(current_setting('t.p1')::uuid, 'en_validacion');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.p1')::uuid, 'confirmado');
reset role;

-- ===== Proponer: quién puede y a quién =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select lives_ok(format($$select set_config('t.f1', public.offer_order_to_courier(%L, %L)::text, true)$$, current_setting('t.o1'), current_setting('t.ca')),
  'la coordinación propone el pedido 1 a A');
select throws_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.o2'), current_setting('t.cb')), '22023', null::text, 'no se propone a quien no está disponible');
select throws_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.o2'), current_setting('t.cc')), '22023', null::text, 'ni a una ficha sin cuenta');
select throws_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.p1'), current_setting('t.cd')), '22023', null::text, 'ni un programado a un repartidor con moto');
select throws_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.o1'), current_setting('t.ce')), '23505', null::text, 'un pedido con propuesta abierta no se propone a otro');
select throws_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.o2'), current_setting('t.ca')), '23505', null::text, 'un repartidor con propuesta abierta no recibe otra');
select throws_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.o2'), gen_random_uuid()), 'P0002', null::text, 'la ficha debe existir');
select is((select string_agg(full_name, ',' order by full_name) from public.offerable_couriers(current_setting('t.o2')::uuid)), 'Rep d,Rep e',
  'los ofrecibles son los disponibles, con cuenta, compatibles y sin propuesta abierta');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select throws_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.o2'), current_setting('t.ce')), '42501', null::text, 'un repartidor no propone pedidos');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select throws_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.o2'), current_setting('t.ce')), '42501', null::text, 'un cliente tampoco');
reset role;

-- ===== Lo que ve el repartidor =====
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is((select count(*) from public.courier_offers()), 1::bigint, 'A ve su propuesta abierta');
select ok((select courier_pay is not null and store_address is not null and expires_at > now() and expires_at <= now() + interval '3 minutes' from public.courier_offers()),
  'con lo que cobra, de dónde sale y un plazo de 3 minutos como máximo');
select is((select count(*) from public.courier_orders()), 0::bigint, 'mientras no acepta, el pedido todavía no es suyo');
reset role;
select tests.authenticate_as((select id from tu where k = 'rd'), 'aal1');
select is((select count(*) from public.courier_offers()), 0::bigint, 'D no ve la propuesta de A');
select throws_ok(format($$select public.courier_accept_offer(%L)$$, current_setting('t.f1')), 'P0002', null::text, 'D no puede aceptar la propuesta de A');
select throws_ok(format($$select public.courier_reject_offer(%L)$$, current_setting('t.f1')), 'P0002', null::text, 'ni rechazarla');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select count(*) from public.order_offers_list), 1::bigint, 'la coordinación ve las propuestas');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select is((select count(*) from public.order_offers_list), 0::bigint, 'un cliente no ve ninguna');
reset role;

-- ===== Aceptar =====
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is(public.courier_accept_offer(current_setting('t.f1')::uuid), 'aceptada', 'A acepta');
select is(public.courier_accept_offer(current_setting('t.f1')::uuid), 'aceptada', 'aceptar dos veces es seguro');
select is((select count(*) from public.courier_orders() where order_id = current_setting('t.o1')::uuid), 1::bigint, 'el pedido pasa a ser suyo');
select is((select count(*) from public.courier_offers()), 0::bigint, 'y la propuesta deja de estar abierta');
reset role;
select is((select courier_id from sales.orders where id = current_setting('t.o1')::uuid), current_setting('t.ca')::uuid, 'el pedido queda asignado a A');
select is((select count(*) from audit.events where action = 'order.courier_assigned' and after_data ->> 'via' = 'oferta'), 1::bigint, 'la asignación por oferta queda auditada una sola vez');

-- ===== Rechazar y reofrecer =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.f2', public.offer_order_to_courier(current_setting('t.o2')::uuid, current_setting('t.cd')::uuid)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'rd'), 'aal1');
select throws_ok(format($$select public.courier_reject_offer(%L, 'no')$$, current_setting('t.f2')), '22023', null::text, 'un motivo demasiado corto se rechaza');
select lives_ok(format($$select public.courier_reject_offer(%L, 'Estoy muy lejos')$$, current_setting('t.f2')), 'D rechaza con motivo');
select lives_ok(format($$select public.courier_reject_offer(%L)$$, current_setting('t.f2')), 'rechazar de nuevo es seguro');
reset role;
select ok((select status = 'rechazada' and reject_reason = 'Estoy muy lejos' from sales.order_offers where id = current_setting('t.f2')::uuid), 'la propuesta queda rechazada con su motivo');
select is((select courier_id from sales.orders where id = current_setting('t.o2')::uuid), null, 'rechazar no asigna el pedido');
select tests.authenticate_as((select id from tu where k = 'coo'));
select lives_ok(format($$select public.offer_order_to_courier(%L, %L)$$, current_setting('t.o2'), current_setting('t.ce')), 'la coordinación lo propone a otro');
select is((select status from public.order_offers_list where courier_id = current_setting('t.cd')::uuid), 'rechazada', 'y ve que D lo rechazó');
reset role;

-- ===== Vencer =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.f3', public.offer_order_to_courier(current_setting('t.o3')::uuid, current_setting('t.cd')::uuid)::text, true);
reset role;
update sales.order_offers set offered_at = now() - interval '5 minutes', expires_at = now() - interval '1 minute' where id = current_setting('t.f3')::uuid;
select tests.authenticate_as((select id from tu where k = 'rd'), 'aal1');
select is((select count(*) from public.courier_offers()), 0::bigint, 'una propuesta vencida no se muestra');
select is(public.courier_accept_offer(current_setting('t.f3')::uuid), 'vencida', 'aceptar una propuesta vencida avisa y no asigna');
reset role;
select is((select status from sales.order_offers where id = current_setting('t.f3')::uuid), 'vencida', 'y la deja marcada como vencida');
select is((select courier_id from sales.orders where id = current_setting('t.o3')::uuid), null, 'el pedido sigue libre');
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.f4', public.offer_order_to_courier(current_setting('t.o3')::uuid, current_setting('t.cd')::uuid)::text, true);
reset role;
update sales.order_offers set offered_at = now() - interval '5 minutes', expires_at = now() - interval '1 minute' where id = current_setting('t.f4')::uuid;
select is(private.expire_stale_offers(), 1, 'el reloj marca como vencida la propuesta que nadie respondió');
select is((select status from sales.order_offers where id = current_setting('t.f4')::uuid), 'vencida', 'queda vencida');

-- ===== Cancelaciones =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.f5', public.offer_order_to_courier(current_setting('t.o3')::uuid, current_setting('t.cd')::uuid)::text, true);
select lives_ok(format($$select public.cancel_order_offer(%L)$$, current_setting('t.f5')), 'la coordinación retira una propuesta');
select throws_ok(format($$select public.cancel_order_offer(%L)$$, current_setting('t.f5')), '22023', null::text, 'y no se retira dos veces');
select set_config('t.f6', public.offer_order_to_courier(current_setting('t.o3')::uuid, current_setting('t.cd')::uuid)::text, true);
select public.assign_order_courier(current_setting('t.o3')::uuid, current_setting('t.ca')::uuid);
reset role;
select is((select status from sales.order_offers where id = current_setting('t.f6')::uuid), 'cancelada', 'asignar directo cancela la propuesta abierta del pedido');
select tests.authenticate_as((select id from tu where k = 'rd'), 'aal1');
select is(public.courier_accept_offer(current_setting('t.f6')::uuid), 'no_disponible', 'aceptar una propuesta cancelada avisa y no asigna');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.f7', public.offer_order_to_courier(current_setting('t.o4')::uuid, current_setting('t.cd')::uuid)::text, true);
select public.set_order_status(current_setting('t.o4')::uuid, 'cancelado', 'el cliente ya no lo quiere');
reset role;
select is((select status from sales.order_offers where id = current_setting('t.f7')::uuid), 'cancelada', 'cancelar el pedido cancela su propuesta');
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.f8', public.offer_order_to_courier(current_setting('t.o5')::uuid, current_setting('t.cd')::uuid)::text, true);
reset role;
update sales.orders set delivery_class = 'programado' where id = current_setting('t.o5')::uuid;
select tests.authenticate_as((select id from tu where k = 'rd'), 'aal1');
select is(public.courier_accept_offer(current_setting('t.f8')::uuid), 'no_disponible', 'si el pedido dejó de ser compatible con su moto, no se asigna');
reset role;
select is((select courier_id from sales.orders where id = current_setting('t.o5')::uuid), null, 'y el pedido sigue libre');
update sales.orders set delivery_class = 'express' where id = current_setting('t.o5')::uuid;
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.f9', public.offer_order_to_courier(current_setting('t.o5')::uuid, current_setting('t.cd')::uuid)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.set_courier_status(current_setting('t.cd')::uuid, 'inactivo', 'ya no trabaja con nosotros');
reset role;
select is((select status from sales.order_offers where id = current_setting('t.f9')::uuid), 'cancelada', 'desactivar al repartidor retira su propuesta abierta');

-- ===== Permisos =====
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('offer_order_to_courier', 'cancel_order_offer', 'offerable_couriers', 'courier_offers', 'courier_accept_offer', 'courier_reject_offer')
    and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no ejecuta ninguna función de ofertas');
select is(has_table_privilege('anon', 'sales.order_offers', 'select'), false, 'anon no lee la tabla de ofertas');

select * from finish();
rollback;
