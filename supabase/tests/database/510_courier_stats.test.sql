begin;
select plan(11);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '510@t.test') from unnest(array['adm', 'coo', 'com', 'cli']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A 510');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.sa', public.create_store((select id from tc where k = 'a'), 'Tienda A 510')::text, true);
select public.set_store_hours(current_setting('t.sa')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.sa')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.sa')::uuid, 'managua');
select set_config('t.pa', public.create_product(current_setting('t.sa')::uuid, 'Café 510')::text, true);
select set_config('t.va', public.create_variant(current_setting('t.pa')::uuid, '500 g', 'CAFE-510', 150)::text, true);
select public.set_product_status(current_setting('t.pa')::uuid, 'publicado');
select public.set_product_delivery(current_setting('t.pa')::uuid, true, 1, 10, 10, 10);
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.c1', public.create_courier('Repartidor Uno 510', '88880001', 'moto')::text, true);
select set_config('t.c2', public.create_courier('Repartidor Dos 510', '88880002', 'moto')::text, true);
reset role;

-- Tres pedidos del repartidor uno: dos entregados (4.0 km pagado con tarjeta y 6.0 km en efectivo sin rendir) y uno en camino.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.o2', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.o3', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

set session_replication_role = replica;
update sales.orders set courier_id = current_setting('t.c1')::uuid, status = 'entregado', delivery_distance_km = 4.0, delivered_at = now(), payment_method = 'tarjeta' where id = current_setting('t.o1')::uuid;
update sales.orders set courier_id = current_setting('t.c1')::uuid, status = 'entregado', delivery_distance_km = 6.0, delivered_at = now() where id = current_setting('t.o2')::uuid;
update sales.orders set courier_id = current_setting('t.c1')::uuid, status = 'en_camino' where id = current_setting('t.o3')::uuid;
insert into sales.order_events (order_id, from_status, to_status, created_at) values
  (current_setting('t.o1')::uuid, 'listo', 'en_camino', now() - interval '30 minutes'),
  (current_setting('t.o2')::uuid, 'listo', 'en_camino', now() - interval '50 minutes');
set session_replication_role = origin;

create temp table rng as select now() - interval '1 day' as f, now() + interval '1 day' as t;
grant select on rng to public;

select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select deliveries from public.courier_stats((select f from rng), (select t from rng)) where courier_id = current_setting('t.c1')::uuid), 2, 'el coordinador ve las entregas del repartidor en el periodo');
select is((select km from public.courier_stats((select f from rng), (select t from rng)) where courier_id = current_setting('t.c1')::uuid), 10.0::numeric, 'y los kilómetros de esas entregas (4 + 6)');
select is((select avg_minutes from public.courier_stats((select f from rng), (select t from rng)) where courier_id = current_setting('t.c1')::uuid), 40.0::numeric, 'el tiempo promedio es de «en camino» a entregado (30 y 50 minutos)');
select is((select active_orders from public.courier_stats((select f from rng), (select t from rng)) where courier_id = current_setting('t.c1')::uuid), 1, 'pedidos en curso');
select is((select cash_pending from public.courier_stats((select f from rng), (select t from rng)) where courier_id = current_setting('t.c1')::uuid), 150::numeric + (select delivery_fee from sales.orders where id = current_setting('t.o2')::uuid), 'efectivo por rendir: solo el entregado sin recibir en caja');
select is((select count(*)::int from public.courier_stats((select f from rng), (select t from rng)) where courier_id = current_setting('t.c2')::uuid), 0, 'un repartidor sin pedidos no aparece (la pantalla lo muestra en cero)');
select is((select sum(deliveries)::int from public.courier_daily(current_setting('t.c1')::uuid, (select f from rng), (select t from rng))), 2, 'el detalle diario suma las entregas');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select deliveries from public.courier_stats((select f from rng), (select t from rng)) where courier_id = current_setting('t.c1')::uuid), 2, 'el administrador también las ve');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*)::int from public.courier_stats((select f from rng), (select t from rng))), 0, 'un comercio no ve estadísticas de repartidores');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select is((select count(*)::int from public.courier_stats((select f from rng), (select t from rng))), 0, 'un cliente tampoco');
reset role;
select ok(not has_function_privilege('anon', 'public.courier_stats(timestamptz, timestamptz)', 'execute'), 'anon no ejecuta las funciones');

select * from finish();
rollback;
