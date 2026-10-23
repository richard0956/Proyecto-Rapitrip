begin;
select plan(18);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '480@t.test') from unnest(array['adm', 'coo', 'caj', 'coma', 'comb', 'cli', 'cl2', 'out']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'coma'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'comb'), 'comercio', (select id from tc where k = 'b'));

-- Una tienda con un producto de 150 en cada comercio
select tests.authenticate_as((select id from tu where k = 'coma'));
select set_config('t.sa', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.sa')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.sa')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.sa')::uuid, 'managua');
select set_config('t.pa', public.create_product(current_setting('t.sa')::uuid, 'Café')::text, true);
select set_config('t.va', public.create_variant(current_setting('t.pa')::uuid, '500 g', 'CAFE-A', 150)::text, true);
select public.set_product_status(current_setting('t.pa')::uuid, 'publicado');
select public.set_product_delivery(current_setting('t.pa')::uuid, true, 1, 10, 10, 10);
reset role;
select tests.authenticate_as((select id from tu where k = 'comb'));
select set_config('t.sb', public.create_store((select id from tc where k = 'b'), 'Tienda B')::text, true);
select public.set_store_hours(current_setting('t.sb')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.sb')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.sb')::uuid, 'managua');
select set_config('t.pb', public.create_product(current_setting('t.sb')::uuid, 'Té')::text, true);
select set_config('t.vb', public.create_variant(current_setting('t.pb')::uuid, 'Caja', 'TE-B', 80)::text, true);
select public.set_product_status(current_setting('t.pb')::uuid, 'publicado');
select public.set_product_delivery(current_setting('t.pb')::uuid, true, 1, 10, 10, 10);
reset role;

-- Pedidos: A tiene uno confirmado (2 x 150) y uno cancelado; B tiene uno confirmado y tres rechazados
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.a1', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":2}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.a2', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.b1', public.create_order(current_setting('t.sb')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vb'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'cl2'));
select set_config('t.b2', public.create_order(current_setting('t.sb')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vb'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.b3', public.create_order(current_setting('t.sb')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vb'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.b4', public.create_order(current_setting('t.sb')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vb'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

-- El dueño de A también es cliente: su compra en la tienda de B no es una venta suya
select tests.authenticate_as((select id from tu where k = 'coma'));
select set_config('t.own', public.create_order(current_setting('t.sb')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.vb'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

-- Estados y fechas puestos a mano (sin disparadores): la prueba es de las cifras, no de la máquina de estados
set session_replication_role = replica;
update sales.orders set status = 'confirmado' where id in (current_setting('t.a1')::uuid, current_setting('t.b1')::uuid, current_setting('t.own')::uuid);
update sales.orders set status = 'cancelado' where id = current_setting('t.a2')::uuid;
update sales.orders set status = 'rechazado' where id in (current_setting('t.b2')::uuid, current_setting('t.b3')::uuid, current_setting('t.b4')::uuid);
-- a1 se hace a las 23:30 hora de Costa Rica (05:30 UTC del día siguiente): debe contar en su día local
update sales.orders set created_at = '2026-10-10 05:30:00+00' where id = current_setting('t.a1')::uuid;
insert into sales.order_events (order_id, from_status, to_status, created_at) values
  (current_setting('t.a1')::uuid, 'confirmado', 'preparando', '2026-10-10 05:40:00+00'),
  (current_setting('t.a1')::uuid, 'preparando', 'listo', '2026-10-10 05:50:00+00');
set session_replication_role = origin;

create temp table rng as select '2026-10-01 06:00:00+00'::timestamptz as f, '2026-11-01 06:00:00+00'::timestamptz as t;
grant select on rng to public;

-- Comercio A: solo ve lo suyo y no cuenta lo cancelado
select tests.authenticate_as((select id from tu where k = 'coma'));
select is((select count(*)::int from public.sales_by_day((select f from rng), (select t from rng))), 1, 'A ve un solo día con ventas');
select is((select sales from public.sales_by_day((select f from rng), (select t from rng), null) where day = '2026-10-09'), (select total from public.orders_list where id = current_setting('t.a1')::uuid), 'la venta de las 23:30 cae en su día local (9 de octubre) y no cuenta el cancelado');
select is((select count(*)::int from public.sales_by_store((select f from rng), (select t from rng))), 1, 'A ve solo su tienda');
select is((select product_name from public.top_products((select f from rng), (select t from rng))), 'Café', 'A ve solo sus productos');
select is((select units from public.top_products((select f from rng), (select t from rng))), 2, 'unidades vendidas del producto');
select is(public.avg_prep_minutes((select f from rng), (select t from rng)), 10.0::numeric, 'el tiempo de preparación es la diferencia entre preparando y listo');
select is(public.overdue_confirmations(), 0, 'un comercio no ve confirmaciones vencidas ajenas');
select is((select count(*)::int from public.repeat_rejections()), 0, 'un comercio no ve los rechazos repetidos');
reset role;

-- La compra propia en otra tienda no entra en las cifras del comercio
select tests.authenticate_as((select id from tu where k = 'coma'));
select is((select count(*)::int from public.sales_by_store((select f from rng), (select t from rng)) where store_name = 'Tienda B'), 0, 'las compras que el dueño hace como cliente no cuentan como ventas suyas (por tienda)');
select is((select coalesce(sum(orders), 0)::int from public.sales_by_day((select f from rng), (select t from rng))), 1, 'ni en las ventas por día');
select is((select count(*)::int from public.top_products((select f from rng), (select t from rng)) where product_name = 'Té'), 0, 'ni en los productos más vendidos');
reset role;

-- Comercio B no ve nada de A, y no hay tiempo de preparación en sus pedidos
select tests.authenticate_as((select id from tu where k = 'comb'));
select is((select count(*)::int from public.sales_by_store((select f from rng), (select t from rng)) where store_name = 'Tienda A'), 0, 'B no ve la tienda de A');
select is(public.avg_prep_minutes((select f from rng), (select t from rng)), null::numeric, 'sin eventos de preparación el promedio es nulo');
reset role;

-- Administración ve todo; los rechazos repetidos solo son para ella
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select count(*)::int from public.sales_by_store((select f from rng), (select t from rng)) where store_name in ('Tienda A', 'Tienda B')), 2, 'el administrador ve las dos tiendas');
select is((select rejections from public.repeat_rejections() where store_name = 'Tienda B'), 3, 'el administrador ve el comercio con 3 rechazos');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select count(*)::int from public.repeat_rejections()), 0, 'el coordinador no ve rechazos repetidos');
reset role;

-- Quien no tiene pedidos ni rol no ve cifras
select tests.authenticate_as((select id from tu where k = 'out'));
select is((select count(*)::int from public.sales_by_day((select f from rng), (select t from rng))), 0, 'una cuenta sin pedidos ni rol no ve ventas');
reset role;
select ok(not has_function_privilege('anon', 'public.sales_by_day(timestamptz, timestamptz, uuid)', 'execute'), 'anon no ejecuta las cifras');

select * from finish();
rollback;
