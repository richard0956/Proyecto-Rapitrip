begin;
select plan(7);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '490@t.test') from unnest(array['adm', 'coma', 'cli']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A 490');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coma'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'coma'));
select set_config('t.sa', public.create_store((select id from tc where k = 'a'), 'Tienda A 490')::text, true);
select public.set_store_hours(current_setting('t.sa')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.sa')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.sa')::uuid, 'managua');
select set_config('t.pa', public.create_product(current_setting('t.sa')::uuid, 'Café 490')::text, true);
select set_config('t.va', public.create_variant(current_setting('t.pa')::uuid, '500 g', 'CAFE-490', 150)::text, true);
select public.set_product_status(current_setting('t.pa')::uuid, 'publicado');
select public.set_product_delivery(current_setting('t.pa')::uuid, true, 1, 10, 10, 10);
reset role;

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.a1', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":2}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.a2', public.create_order(current_setting('t.sa')::uuid, format('[{"variant_id":"%s","quantity":5}]', current_setting('t.va'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

set session_replication_role = replica;
update sales.orders set status = 'confirmado' where id = current_setting('t.a1')::uuid;
update sales.orders set status = 'cancelado' where id = current_setting('t.a2')::uuid;
set session_replication_role = origin;

create temp table rng as select now() - interval '1 day' as f, now() + interval '1 day' as t;
grant select on rng to public;

select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select units from public.product_sales((select f from rng), (select t from rng)) where product_id = current_setting('t.pa')::uuid), 2, 'el administrador ve las unidades vendidas del producto y no cuenta lo cancelado');
select is((select sales from public.product_sales((select f from rng), (select t from rng)) where product_id = current_setting('t.pa')::uuid), 300::numeric, 'y el importe de los productos (sin envío)');
select is((select count(*)::int from public.product_sales(now() + interval '2 days', now() + interval '3 days')), 0, 'fuera del periodo no hay ventas');
reset role;

select tests.authenticate_as((select id from tu where k = 'coma'));
select is((select count(*)::int from public.product_sales((select f from rng), (select t from rng))), 0, 'el comercio no usa esta función: devuelve vacío');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select is((select count(*)::int from public.product_sales((select f from rng), (select t from rng))), 0, 'un cliente tampoco ve ventas de productos');
reset role;
select ok(not has_function_privilege('anon', 'public.product_sales(timestamptz, timestamptz)', 'execute'), 'anon no ejecuta la función');
select ok(has_function_privilege('authenticated', 'public.product_sales(timestamptz, timestamptz)', 'execute'), 'authenticated sí puede llamarla (la función filtra por rol)');

select * from finish();
rollback;
