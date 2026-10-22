begin;
select plan(18);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'emp', tests.create_user('emp@t.test');
insert into tu select 'inf', tests.create_user('inf@t.test');
insert into tu select 'otro', tests.create_user('otro@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');

-- Solicitud de empresa: tipo y RUC
select tests.authenticate_as((select id from tu where k = 'emp'), 'aal1');
select throws_ok($$select public.submit_commerce_request('Empresa X', '{"business_kind":"empresa","ruc":"123"}')$$, '22023', null::text, 'una empresa con RUC demasiado corto se rechaza');
select throws_ok($$select public.submit_commerce_request('Empresa X', '{"business_kind":"empresa"}')$$, '22023', null::text, 'una empresa sin RUC se rechaza');
select throws_ok($$select public.submit_commerce_request('Empresa X', '{"business_kind":"raro"}')$$, '22023', null::text, 'un tipo desconocido se rechaza');
select lives_ok($$select set_config('t.req', public.submit_commerce_request('Distribuidora Norte S.A.', '{"business_kind":"empresa","ruc":"j-0310 0000 12345"}')::text, true)$$, 'una empresa con RUC válido envía su solicitud');
reset role;
select is((select details ->> 'ruc' from identity.commerce_requests where id = current_setting('t.req')::uuid), 'J0310000012345', 'el RUC se guarda sin espacios ni guiones y en mayúsculas');

select tests.authenticate_as((select id from tu where k = 'otro'), 'aal1');
select throws_ok($$select public.submit_commerce_request('Otra empresa', '{"business_kind":"empresa","ruc":"J0310000012345"}')$$, '23505', null::text, 'el mismo RUC no se solicita dos veces');
reset role;

-- Vendedor propio: no guarda RUC aunque lo envíe
select tests.authenticate_as((select id from tu where k = 'inf'), 'aal1');
select lives_ok($$select set_config('t.req2', public.submit_commerce_request('Puesto de Lola', '{"ruc":"XXXXXXXXXXXX"}')::text, true)$$, 'sin tipo se toma como vendedor propio');
reset role;
select is((select details ->> 'business_kind' from identity.commerce_requests where id = current_setting('t.req2')::uuid), 'informal', 'queda como informal');
select ok(not (select details ? 'ruc' from identity.commerce_requests where id = current_setting('t.req2')::uuid), 'y no conserva el RUC');

-- Aprobación: el comercio nace con su tipo y RUC
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select set_config('t.c1', public.approve_commerce_request(%L, true)::text, true)$$, current_setting('t.req')), 'se aprueba la empresa');
select lives_ok(format($$select set_config('t.c2', public.approve_commerce_request(%L, true)::text, true)$$, current_setting('t.req2')), 'se aprueba el vendedor propio');
select is((select kind || '/' || ruc from public.commerces_list where id = current_setting('t.c1')::uuid), 'empresa/J0310000012345', 'la empresa queda con su RUC');
select is((select kind from public.commerces_list where id = current_setting('t.c2')::uuid), 'informal', 'el vendedor propio queda como informal');
reset role;
select throws_ok($$insert into identity.commerces (name, kind) values ('Mala', 'empresa')$$, '23514', null::text, 'la base de datos no admite una empresa sin RUC');

-- Catálogo con filtros
select tests.authenticate_as((select id from tu where k = 'emp'));
select set_config('t.store1', public.create_store(current_setting('t.c1')::uuid, 'Tienda Empresa')::text, true);
select public.set_store_hours(current_setting('t.store1')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.p1', public.create_product(current_setting('t.store1')::uuid, 'Arroz')::text, true);
select public.create_variant(current_setting('t.p1')::uuid, 'Libra', 'ARR-1', 14);
select public.create_variant(current_setting('t.p1')::uuid, 'Quintal', 'ARR-100', 1250);
select public.set_product_status(current_setting('t.p1')::uuid, 'publicado');
reset role;

select tests.authenticate_as_anon();
select is((select commerce_kind from public.catalog_search_stores() where id = current_setting('t.store1')::uuid), 'empresa', 'la tienda pública muestra el tipo de comercio');
select is((select min_price from public.catalog_search_products(p_kind => 'empresa') where id = current_setting('t.p1')::uuid), 14.00::numeric, 'el filtro por tipo encuentra el producto de la empresa');
select is((select count(*)::int from public.catalog_search_products(current_setting('t.store1')::uuid, p_kind => 'informal')), 0, 'y el filtro de vendedor propio no lo muestra');
select is((select count(*)::int from public.catalog_search_products(current_setting('t.store1')::uuid, p_min_price => 100)), 0, 'el rango de precio usa la variante más barata disponible');
reset role;

select * from finish();
rollback;
