begin;
select plan(20);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'com2', tests.create_user('com2@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'com2'), 'comercio', (select id from tc where k = 'b'));

-- Tienda con un producto vendible
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.store')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prod', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 100)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');

-- Ubicación de la tienda
select lives_ok(format($$select public.set_store_location(%L, 12.136400, -86.251400)$$, current_setting('t.store')),
  'el comercio ubica su tienda');
select is((select latitude from public.stores_list where id = current_setting('t.store')::uuid), 12.136400::numeric,
  'el comercio lee la ubicación de su tienda');
select throws_ok(format($$select public.set_store_location(%L, 12.1, null)$$, current_setting('t.store')), '22023', null::text,
  'la ubicación va completa o no va');
select throws_ok(format($$select public.set_store_location(%L, 40.7, -74.0)$$, current_setting('t.store')), '22023', null::text,
  'un punto fuera de Nicaragua se rechaza');
select lives_ok(format($$select public.set_store_location(%L, null, null)$$, current_setting('t.store')), 'se puede quitar la ubicación');
select is((select latitude from public.stores_list where id = current_setting('t.store')::uuid), null,
  'quitarla deja la tienda sin ubicar');
select lives_ok(format($$select public.set_store_location(%L, 12.136400, -86.251400)$$, current_setting('t.store')), 'y volver a ponerla');
reset role;

select tests.authenticate_as((select id from tu where k = 'com2'));
select throws_ok(format($$select public.set_store_location(%L, 12.14, -86.25)$$, current_setting('t.store')), '42501', null::text,
  'otro comercio no cambia la ubicación ajena');
reset role;

select ok(exists (select 1 from audit.events where action = 'store.location_changed')
  and not exists (select 1 from audit.events where action = 'store.location_changed' and after_data::text ~ 'latitude|longitude'),
  'el cambio queda auditado sin guardar las coordenadas');
select ok(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'catalog\_%' and pg_get_function_result(p.oid) ~ 'latitude|longitude'),
  'las funciones públicas del catálogo no devuelven coordenadas');

-- Pin del pedido
select tests.authenticate_as((select id from tu where k = 'cli'));
select lives_ok(format($$select set_config('t.o1', public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null,
  '33333333-3333-3333-3333-333333333333', 12.128000, -86.264900)::text, true)$$,
  current_setting('t.store'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))),
  'el cliente pide con el pin de su destino');
select is((select latitude from public.order_delivery_list where order_id = current_setting('t.o1')::uuid), 12.128000::numeric,
  'el pedido guarda el pin');
select is(public.create_order(current_setting('t.store')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, '33333333-3333-3333-3333-333333333333', 12.128000, -86.264900)::text,
  current_setting('t.o1'), 'reintentar con la misma referencia devuelve el mismo pedido');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 40.7, -74.0)$$,
  current_setting('t.store'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))), '22023', null::text,
  'un destino fuera de Nicaragua se rechaza');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.1, null)$$,
  current_setting('t.store'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))), '22023', null::text,
  'el pin del pedido va completo o no va');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Sin pin, casa 9', '88881111')$$,
  current_setting('t.store'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))), '22023', null::text,
  'el pin del destino es obligatorio: sin él no hay pedido');
reset role;

select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*)::int from public.order_delivery_list), 0, 'el comercio no ve el destino de los clientes, tampoco su pin');
reset role;

-- Libreta de direcciones: el pin se valida
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok($$select public.save_address(null, 'Lejos', 'Una dirección válida', null, null, false, 40.7, -74.0)$$, '22023', null::text,
  'una dirección guardada con pin fuera de Nicaragua se rechaza');
select lives_ok($$select public.save_address(null, 'Casa', 'Barrio Central, casa 4', null, null, false, 12.136400, -86.251400)$$,
  'y con un pin dentro de Nicaragua se guarda');
reset role;

-- Anonimizar la cuenta borra el destino (y su pin)
update identity.profiles set status = 'anonimizada' where id = (select id from tu where k = 'cli');
select is((select count(*)::int from sales.order_delivery d join sales.orders o on o.id = d.order_id
  where o.client_id = (select id from tu where k = 'cli')), 0, 'anonimizar borra el destino de los pedidos y su pin');

select * from finish();
rollback;
