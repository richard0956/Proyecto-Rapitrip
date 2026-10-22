begin;
select plan(11);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

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
reset role;

-- El cliente hace un pedido suelto (create_order) y después una compra con dos tiendas pagada con tarjeta.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.single', public.create_order(current_setting('t.a')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.va'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.co', public.create_checkout(format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":2}]},{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]',
  current_setting('t.a'), current_setting('t.va'), current_setting('t.b'), current_setting('t.vb'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::jsonb ->> 'checkout_id', true);

select is((select count(*)::int from public.my_order_units), 2, 'el listado tiene dos unidades: el pedido suelto y la compra');
select is((select order_count from public.my_order_units where unit_id = current_setting('t.co')::uuid), 2, 'la compra agrupa sus dos pedidos');
select is((select checkout_id from public.my_order_units where unit_id = current_setting('t.co')::uuid), current_setting('t.co')::uuid, 'y dice de qué compra es');
select is((select total from public.my_order_units where unit_id = current_setting('t.co')::uuid), 420::numeric, 'su total suma los pedidos (2 × 150 + 50 y 20 + 50)');
select is((select payment_status from public.my_order_units where unit_id = current_setting('t.co')::uuid), 'pendiente', 'muestra que falta pagar con tarjeta');
select is((select order_count from public.my_order_units where unit_id = current_setting('t.single')::uuid), 1, 'un pedido suelto es una unidad de un pedido');
select is((select checkout_id from public.my_order_units where unit_id = current_setting('t.single')::uuid), null::uuid, 'sin compra');
select is((select unit_id from public.my_order_units order by created_at desc, unit_id limit 1), current_setting('t.co')::uuid, 'las unidades se ordenan de la más reciente a la más antigua');
reset role;

select is(tests.count_as((select id from tu where k = 'cli2'), 'public.my_order_units'), 0::bigint, 'otro cliente no ve unidades ajenas');
select ok(not has_table_privilege('anon', 'public.my_order_units', 'select'), 'anon no lee la vista');
select is(tests.count_as((select id from tu where k = 'com'), 'public.my_order_units'), 0::bigint, 'el comercio tampoco: la vista es del cliente');

select * from finish();
rollback;
