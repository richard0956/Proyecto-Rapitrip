begin;
select plan(10);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '500@t.test') from unnest(array['adm', 'coma', 'comb', 'cli', 'cl2']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A 500');
insert into tc select 'b', tests.create_commerce('Comercio B 500');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coma'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'comb'), 'comercio', (select id from tc where k = 'b'));

select tests.authenticate_as((select id from tu where k = 'coma'));
select set_config('t.sa', public.create_store((select id from tc where k = 'a'), 'Tienda A 500')::text, true);
select public.set_store_hours(current_setting('t.sa')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.sa')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.sa')::uuid, 'managua');
select set_config('t.pa', public.create_product(current_setting('t.sa')::uuid, 'Café 500')::text, true);
select set_config('t.va', public.create_variant(current_setting('t.pa')::uuid, '500 g', 'CAFE-500A', 150)::text, true);
select public.set_product_status(current_setting('t.pa')::uuid, 'publicado');
select public.set_product_delivery(current_setting('t.pa')::uuid, true, 1, 10, 10, 10);
reset role;
select tests.authenticate_as((select id from tu where k = 'comb'));
select set_config('t.sb', public.create_store((select id from tc where k = 'b'), 'Tienda B 500')::text, true);
select public.set_store_hours(current_setting('t.sb')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.sb')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.sb')::uuid, 'managua');
select set_config('t.pb', public.create_product(current_setting('t.sb')::uuid, 'Té 500')::text, true);
select set_config('t.vb', public.create_variant(current_setting('t.pb')::uuid, 'Caja', 'TE-500B', 80)::text, true);
select public.set_product_status(current_setting('t.pb')::uuid, 'publicado');
select public.set_product_delivery(current_setting('t.pb')::uuid, true, 1, 10, 10, 10);
reset role;

-- A: un pedido de 2 entregado, uno de 3 confirmado, uno de 1 cancelado y uno de 4 por confirmar. B: uno de 1 confirmado.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":2}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.o2', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":3}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.o3', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'cl2'));
select set_config('t.o4', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":4}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.o5', public.create_order(current_setting('t.sb')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vb'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

set session_replication_role = replica;
update sales.orders set status = 'entregado' where id = current_setting('t.o1')::uuid;
update sales.orders set status = 'confirmado' where id in (current_setting('t.o2')::uuid, current_setting('t.o5')::uuid);
update sales.orders set status = 'cancelado' where id = current_setting('t.o3')::uuid;
set session_replication_role = origin;

create temp table rng as select now() - interval '1 day' as f, now() + interval '1 day' as t;
grant select on rng to public;

select tests.authenticate_as((select id from tu where k = 'coma'));
select is((select units from public.product_stats((select f from rng), (select t from rng)) where product_id = current_setting('t.pa')::uuid), 5, 'unidades vendidas: el entregado y el confirmado (2 + 3), sin el cancelado ni el por confirmar');
select is((select orders from public.product_stats((select f from rng), (select t from rng)) where product_id = current_setting('t.pa')::uuid), 2, 'pedidos en los que estuvo el producto');
select is((select reserved_units from public.product_stats((select f from rng), (select t from rng)) where product_id = current_setting('t.pa')::uuid), 7, 'unidades apartadas: lo que está en pedidos sin entregar ni cancelar (3 confirmado + 4 por confirmar)');
select is((select cancelled_units from public.product_stats((select f from rng), (select t from rng)) where product_id = current_setting('t.pa')::uuid), 1, 'unidades en pedidos cancelados');
select is((select count(*)::int from public.product_stats((select f from rng), (select t from rng)) where product_id = current_setting('t.pb')::uuid), 0, 'no ve los productos de otro comercio');
select is((select sum(units)::int from public.product_daily(current_setting('t.pa')::uuid, (select f from rng), (select t from rng))), 5, 'el flujo diario suma las unidades vendidas');
select is((select count(*)::int from public.product_daily(current_setting('t.pb')::uuid, (select f from rng), (select t from rng))), 0, 'el flujo diario de un producto ajeno viene vacío');
select is((select product_name from public.store_top_products((select f from rng), (select t from rng), 3) where store_id = current_setting('t.sa')::uuid and rank = 1), 'Café 500', 'producto estrella de la tienda');
select is((select count(*)::int from public.store_top_products((select f from rng), (select t from rng), 3) where store_id = current_setting('t.sb')::uuid), 0, 'no ve los productos estrella de la tienda de otro comercio');
reset role;

select ok(not has_function_privilege('anon', 'public.product_stats(timestamptz, timestamptz, uuid)', 'execute'), 'anon no ejecuta las funciones');

select * from finish();
rollback;
