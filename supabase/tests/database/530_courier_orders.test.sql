begin;
select plan(33);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'ra', tests.create_user('ra@t.test', 'Rep A');
insert into tu select 'rb', tests.create_user('rb@t.test', 'Rep B');
insert into tu select 'c1', tests.create_user('c1@t.test', 'Cliente Uno García');
insert into tu select 'c2', tests.create_user('c2@t.test', 'Cliente Dos');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'ra'), 'repartidor');
select tests.grant_role((select id from tu where k = 'rb'), 'repartidor');

-- Tienda con dirección, un café express y dos repartidores con cuenta.
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.s')::uuid, 'managua');
select set_config('t.pc', public.create_product(current_setting('t.s')::uuid, 'Café')::text, true);
select set_config('t.vc', public.create_variant(current_setting('t.pc')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select public.set_product_status(current_setting('t.pc')::uuid, 'publicado');
select public.set_product_delivery(current_setting('t.pc')::uuid, true, 1, 10, 10, 10);
reset role;
update commerce.stores set address = 'Km 5 Carretera Norte, local 3', contact_phone = '22551234' where id = current_setting('t.s')::uuid;

select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.cra', public.create_courier('Rep A', '88880001', 'moto')::text, true);
select set_config('t.crb', public.create_courier('Rep B', '88880002', 'moto')::text, true);
reset role;
update identity.couriers set user_id = (select id from tu where k = 'ra') where id = current_setting('t.cra')::uuid;
update identity.couriers set user_id = (select id from tu where k = 'rb') where id = current_setting('t.crb')::uuid;

select set_config('t.cart', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":2}]}]', current_setting('t.s'), current_setting('t.vc')), true);

-- Cuatro pedidos en efectivo: o1 y o4 para A, o2 para B, o3 sin repartidor.
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.k1', public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', 'Portón verde', null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true);
select set_config('t.k3', public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true);
select set_config('t.k4', public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true);
reset role;
select tests.authenticate_as((select id from tu where k = 'c2'));
select set_config('t.k2', public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Colonia Nueva', '88882222', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true);
reset role;
select set_config('t.o' || n, (select id::text from sales.orders where checkout_id = current_setting('t.k' || n)::uuid), true) from unnest(array['1', '2', '3', '4']) n;

-- El comercio confirma los cuatro; la coordinación los asigna.
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(o::uuid, 'confirmado') from unnest(array[current_setting('t.o1'), current_setting('t.o2'), current_setting('t.o3'), current_setting('t.o4')]) o;
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(current_setting('t.o1')::uuid, current_setting('t.cra')::uuid);
select public.assign_order_courier(current_setting('t.o4')::uuid, current_setting('t.cra')::uuid);
select public.assign_order_courier(current_setting('t.o2')::uuid, current_setting('t.crb')::uuid);
reset role;

-- ===== Qué pedidos ve =====
select set_config('t.tot', (select total::text from sales.orders where id = current_setting('t.o1')::uuid), true);
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is((select count(*) from public.courier_orders()), 2::bigint, 'A ve solo sus dos pedidos asignados (ni el de B ni el que no tiene repartidor)');
select is((select count(*) from public.courier_orders() where order_id = current_setting('t.o2')::uuid), 0::bigint, 'el pedido de otro repartidor no aparece');
select is((select count(*) from public.courier_orders() where order_id = current_setting('t.o3')::uuid), 0::bigint, 'un pedido sin repartidor no aparece');
select is((select store_address from public.courier_order(current_setting('t.o1')::uuid)), 'Km 5 Carretera Norte, local 3', 've la dirección de la tienda para recoger');
select is((select cash_total::text from public.courier_order(current_setting('t.o1')::uuid)), current_setting('t.tot'), 'en efectivo ve cuánto debe cobrar');
select is((select jsonb_array_length(items) from public.courier_order(current_setting('t.o1')::uuid)), 1, 've los productos del pedido');
select is((select items -> 0 ->> 'quantity' from public.courier_order(current_setting('t.o1')::uuid)), '2', 'con su cantidad');
select ok(not exists (select 1 from public.courier_order(current_setting('t.o1')::uuid) where items::text like '%sku%' or items::text like '%CAFE-500%'), 'sin SKU');
select throws_ok(format($$select * from public.courier_order(%L)$$, current_setting('t.o2')), 'P0002', null::text, 'el pedido de otro repartidor responde «no encontrado»');
select throws_ok($$select * from public.courier_order(gen_random_uuid())$$, 'P0002', null::text, 'y uno inexistente responde igual');

-- ===== Datos del cliente: solo con el pedido listo o en camino =====
select ok((select delivery_address is null and delivery_phone is null and delivery_notes is null and client_first_name is null and dest_latitude is null
           from public.courier_order(current_setting('t.o1')::uuid)), 'confirmado: no ve dirección, teléfono, nota, nombre ni punto del cliente');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.o1')::uuid, 'preparando');
select public.set_order_status(current_setting('t.o1')::uuid, 'listo');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is((select delivery_address from public.courier_order(current_setting('t.o1')::uuid)), 'Barrio Central, casa 4', 'listo: ve la dirección de entrega');
select is((select delivery_phone from public.courier_order(current_setting('t.o1')::uuid)), '88881111', 'y el teléfono');
select is((select delivery_notes from public.courier_order(current_setting('t.o1')::uuid)), 'Portón verde', 'y la nota');
select is((select client_first_name from public.courier_order(current_setting('t.o1')::uuid)), 'Cliente', 'del cliente solo el nombre de pila');
select ok((select dest_latitude is not null and dest_longitude is not null from public.courier_order(current_setting('t.o1')::uuid)), 'y el punto del mapa');
reset role;
select tests.authenticate_as((select id from tu where k = 'rb'), 'aal1');
select is((select delivery_address from public.courier_order(current_setting('t.o2')::uuid)), null, 'confirmado: B tampoco ve la dirección de su pedido');
reset role;

-- ===== Entregado: los datos del cliente desaparecen =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.set_order_status(current_setting('t.o1')::uuid, 'en_camino', 'despacho de prueba sin evidencia');
select public.set_order_status(current_setting('t.o1')::uuid, 'entregado', 'entrega de prueba sin evidencia');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select ok((select delivery_address is null and delivery_phone is null and client_first_name is null and dest_latitude is null
           from public.courier_order(current_setting('t.o1')::uuid)), 'entregado: ya no ve ningún dato del cliente');
select is((select status from public.courier_orders() limit 1), 'confirmado', 'lo abierto va antes que lo ya entregado');
select is((select status from public.courier_orders() order by case status when 'entregado' then 1 else 0 end desc limit 1), 'entregado', 'y lo entregado hoy sigue en la lista, al final');

-- ===== Historial y efectivo =====
select is((select cash_registered from public.courier_history(7) where order_id = current_setting('t.o1')::uuid), false, 'la entrega en efectivo aparece sin rendir');
select lives_ok(format($$select public.register_courier_cash(%L)$$, current_setting('t.o1')), 'el repartidor registra el efectivo cobrado');
select is((select cash_registered from public.courier_history(7) where order_id = current_setting('t.o1')::uuid), true, 'y el historial lo refleja');
select lives_ok($$select * from public.courier_history(500)$$, 'el rango pedido se limita a 31 días en vez de fallar');
reset role;
update sales.orders set delivered_at = now() - interval '2 days' where id = current_setting('t.o1')::uuid;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is((select count(*) from public.courier_orders() where order_id = current_setting('t.o1')::uuid), 0::bigint, 'una entrega de ayer sale de la lista del día');
select is((select count(*) from public.courier_history(7) where order_id = current_setting('t.o1')::uuid), 1::bigint, 'pero sigue en el historial');
reset role;

-- ===== Pedidos que se caen, y quien no es repartidor =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.set_order_status(current_setting('t.o4')::uuid, 'cancelado', 'el cliente ya no lo quiere');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is((select count(*) from public.courier_orders()), 0::bigint, 'un pedido cancelado deja de aparecer');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok($$select * from public.courier_orders()$$, '42501', null::text, 'la coordinación no usa las funciones del repartidor');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select throws_ok(format($$select * from public.courier_order(%L)$$, current_setting('t.o1')), '42501', null::text, 'un cliente tampoco');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.set_courier_status(%L, 'inactivo', 'ya no trabaja con nosotros')$$, current_setting('t.cra')), 'la administración desactiva al repartidor A');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select throws_ok($$select * from public.courier_orders()$$, '42501', null::text, 'con la ficha inactiva ya no ve nada');
reset role;

-- ===== Permisos =====
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('courier_orders', 'courier_order', 'courier_history')
    and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no ejecuta las funciones de lectura del repartidor');
select is(has_function_privilege('authenticated', 'private.apply_order_transition(sales.orders,text,text)', 'execute'), false,
  'el núcleo de transiciones no es ejecutable desde la API');

select * from finish();
rollback;
