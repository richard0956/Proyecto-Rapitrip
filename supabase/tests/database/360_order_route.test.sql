begin;
select plan(14);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'com2', tests.create_user('com2@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'com2'), 'comercio', (select id from tc where k = 'b'));

-- Tienda A ubicada (Metrocentro) y tienda B sin ubicar, cada una con un producto
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.storeA', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.storeA')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.storeA')::uuid, 12.128000, -86.264900);
select set_config('t.prodA', public.create_product(current_setting('t.storeA')::uuid, 'Café')::text, true);
select set_config('t.varA', public.create_variant(current_setting('t.prodA')::uuid, '500 g', 'CAFE-500', 100)::text, true);
select public.set_product_status(current_setting('t.prodA')::uuid, 'publicado');
reset role;

select tests.authenticate_as((select id from tu where k = 'com2'));
select set_config('t.storeB', public.create_store((select id from tc where k = 'b'), 'Tienda B')::text, true);
select public.set_store_hours(current_setting('t.storeB')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prodB', public.create_product(current_setting('t.storeB')::uuid, 'Pan')::text, true);
select set_config('t.varB', public.create_variant(current_setting('t.prodB')::uuid, 'Unidad', 'PAN-1', 20)::text, true);
select public.set_product_status(current_setting('t.prodB')::uuid, 'publicado');
-- La tienda B se ubica para poder recibir el pedido; se la deja sin ubicar después (ver más abajo).
select public.set_store_location(current_setting('t.storeB')::uuid, 12.159400, -86.274400);
reset role;

-- Pedidos del cliente: A con pin (Plaza de la Fe), A sin pin y B con pin
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.storeA')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.varA'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, '11111111-1111-1111-1111-111111111111', 12.159400, -86.274400)::text, true);
select set_config('t.o2', public.create_order(current_setting('t.storeA')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.varA'))::jsonb,
  'efectivo', 'Sin pin, casa 9', '88881111', null, null, 12.159400, -86.274400)::text, true);
select set_config('t.o3', public.create_order(current_setting('t.storeB')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.varB'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, '22222222-2222-2222-2222-222222222222', 12.159400, -86.274400)::text, true);
select throws_ok(format($$select * from public.order_route_points(%L)$$, current_setting('t.o1')), '42501', null::text, 'el cliente no usa la función de ruta');
select throws_ok(format($$select public.order_distance_km(%L)$$, current_setting('t.o1')), '42501', null::text, 'ni la de distancia');
reset role;
-- Casos límite que ya no se pueden crear por la vía normal (el pin y la ubicación son obligatorios): se simulan.
update sales.order_delivery set latitude = null, longitude = null where order_id = current_setting('t.o2')::uuid;
update commerce.stores set latitude = null, longitude = null where id = current_setting('t.storeB')::uuid;

-- Coordinación: los dos puntos
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select dest_latitude from public.order_route_points(current_setting('t.o1')::uuid)), 12.159400::numeric, 'coordinación ve el destino');
select is((select store_latitude from public.order_route_points(current_setting('t.o1')::uuid)), 12.128000::numeric, 'y la tienda');
select is((select dest_latitude from public.order_route_points(current_setting('t.o2')::uuid)), null, 'un pedido sin pin no trae destino');
select is((select store_latitude from public.order_route_points(current_setting('t.o3')::uuid)), null, 'una tienda sin ubicar no trae coordenadas');
select throws_ok($$select * from public.order_route_points('00000000-0000-0000-0000-000000000000')$$, 'P0002', null::text, 'un pedido inexistente se informa');
select ok((select public.order_distance_km(current_setting('t.o1')::uuid)) between 3.4 and 4.2, 'distancia en línea recta de unos 3,7 km');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select ok((select dest_latitude from public.order_route_points(current_setting('t.o1')::uuid)) is not null, 'la administración también ve la ruta');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'), 'aal1');
select throws_ok(format($$select * from public.order_route_points(%L)$$, current_setting('t.o1')), '42501', null::text, 'sin segundo factor no se ve la ruta');
reset role;

-- Comercio: solo la distancia, y solo de lo suyo
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok(format($$select * from public.order_route_points(%L)$$, current_setting('t.o1')), '42501', null::text, 'el comercio no ve el destino del cliente');
select ok((select public.order_distance_km(current_setting('t.o1')::uuid)) between 3.4 and 4.2, 'el comercio ve la distancia aproximada');
select is((select public.order_distance_km(current_setting('t.o2')::uuid)), null, 'sin pin del cliente no hay distancia');
select throws_ok(format($$select public.order_distance_km(%L)$$, current_setting('t.o3')), '42501', null::text, 'ni la distancia de pedidos de otro comercio');
reset role;

select * from finish();
rollback;
