begin;
select plan(9);

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
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.store')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prod', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 100)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');
select public.set_stock_tracking(current_setting('t.var')::uuid, true, 2);
select public.add_stock(current_setting('t.var')::uuid, 10, 'compra inicial');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":3}]', current_setting('t.var'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, '11111111-1111-1111-1111-111111111111')::text, true);
select set_config('t.o1b', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":3}]', current_setting('t.var'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, '11111111-1111-1111-1111-111111111111')::text, true);
select is(current_setting('t.o1b'), current_setting('t.o1'), 'repetir la misma referencia devuelve el mismo pedido');
select is((select count(*)::int from public.orders_list), 1, 'y no se crea un segundo pedido');

select set_config('t.o2', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, '22222222-2222-2222-2222-222222222222')::text, true);
select isnt(current_setting('t.o2'), current_setting('t.o1'), 'otra referencia crea otro pedido');

select lives_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111')$$,
  current_setting('t.store'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))),
  'sin referencia sigue funcionando como antes (seis argumentos)');
select throws_ok($$select private.create_order_core(null, null, null, null, null)$$, null::text, null::text,
  'el núcleo no es invocable por el cliente');
reset role;

select is((select quantity from commerce.inventory where variant_id = current_setting('t.var')::uuid), 5,
  'el stock se reservó una sola vez por referencia: 3 + 1 + 1 de 10');

-- La misma referencia en otro cliente no colisiona ni revela pedidos ajenos.
select tests.authenticate_as((select id from tu where k = 'cli2'));
select set_config('t.o3', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb,
  'efectivo', 'Barrio Central, casa 9', '88882222', null, '11111111-1111-1111-1111-111111111111')::text, true);
select isnt(current_setting('t.o3'), current_setting('t.o1'), 'la referencia es por cliente: otro cliente no recibe el pedido ajeno');
select is((select count(*)::int from public.orders_list), 1, 'cada cliente ve solo el suyo');
reset role;

select is((select count(*)::int from sales.orders where client_ref is not null), 3, 'las referencias quedan guardadas');

select * from finish();
rollback;
