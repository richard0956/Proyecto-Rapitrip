begin;
select plan(36);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'caj', tests.create_user('caj@t.test');
insert into tu select 'caj2', tests.create_user('caj2@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'adm', tests.create_user('adm@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'caj2'), 'cajero');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

-- Tienda con: café (150, stock controlado de 10), pan (80, sin control) y un producto en borrador.
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select set_config('t.p1', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.v1', public.create_variant(current_setting('t.p1')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select public.set_product_status(current_setting('t.p1')::uuid, 'publicado');
select public.set_stock_tracking(current_setting('t.v1')::uuid, true, 2);
select public.count_stock(current_setting('t.v1')::uuid, 10, 'conteo inicial');
select set_config('t.p2', public.create_product(current_setting('t.store')::uuid, 'Pan')::text, true);
select set_config('t.v2', public.create_variant(current_setting('t.p2')::uuid, 'Unidad', 'PAN-1', 80)::text, true);
select public.set_product_status(current_setting('t.p2')::uuid, 'publicado');
select set_config('t.p3', public.create_product(current_setting('t.store')::uuid, 'Borrador')::text, true);
select set_config('t.v3', public.create_variant(current_setting('t.p3')::uuid, 'Unidad', 'BOR-1', 10)::text, true);
reset role;

-- Solo el equipo de caja
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok($$select public.open_cash_session(100)$$, '42501', null::text, 'un cliente no abre caja');
select throws_ok($$select * from public.counter_catalog()$$, '42501', null::text, 'un cliente no ve el catálogo de mostrador');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok($$select public.open_cash_session(100)$$, '42501', null::text, 'un comercio no abre caja');
reset role;

-- Sin turno no se vende
select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'efectivo')$$, current_setting('t.store'), current_setting('t.v1')),
  '22023', null::text, 'no se vende sin turno de caja abierto');
select throws_ok($$select public.open_cash_session(-5)$$, '22023', null::text, 'el monto inicial no puede ser negativo');
select lives_ok($$select set_config('t.s1', public.open_cash_session(500)::text, true)$$, 'el cajero abre su turno con 500.00');
select throws_ok($$select public.open_cash_session(10)$$, '23505', null::text, 'no puede tener dos turnos abiertos');

-- Catálogo: solo lo vendible
select is((select count(*)::int from public.counter_catalog() where variant_id in (current_setting('t.v1')::uuid, current_setting('t.v2')::uuid)), 2,
  'el catálogo trae café y pan');
select is((select count(*)::int from public.counter_catalog() where variant_id = current_setting('t.v3')::uuid), 0, 'un producto en borrador no se vende');
select is((select quantity from public.counter_catalog() where variant_id = current_setting('t.v1')::uuid), 10, 'el catálogo muestra las existencias controladas');
select is((select quantity from public.counter_catalog() where variant_id = current_setting('t.v2')::uuid), null, 'sin control de stock no hay cantidad');

-- Ventas
select lives_ok(format($$select set_config('t.o1', public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":2},{"variant_id":"%s","quantity":1}]'::jsonb, 'efectivo')::text, true)$$,
  current_setting('t.store'), current_setting('t.v1'), current_setting('t.v2')), 'venta en efectivo: 2 cafés y 1 pan');
select is((select total from public.orders_list where id = current_setting('t.o1')::uuid), 380.00::numeric, 'el total es 2 × 150 + 80');
select is((select status || '/' || payment_status || '/' || channel from public.orders_list where id = current_setting('t.o1')::uuid), 'entregado/pagado/mostrador',
  'la venta nace entregada, pagada y de mostrador');
select is((select client_id from public.orders_list where id = current_setting('t.o1')::uuid), null, 'no tiene cliente');
select lives_ok(format($$select set_config('t.o2', public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'tarjeta')::text, true)$$,
  current_setting('t.store'), current_setting('t.v1')), 'venta con tarjeta en terminal externo');
select throws_ok(format($$select public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":99}]'::jsonb, 'efectivo')$$, current_setting('t.store'), current_setting('t.v1')),
  '22023', null::text, 'no vende más de lo que hay');
select throws_ok(format($$select public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'efectivo')$$, current_setting('t.store'), current_setting('t.v3')),
  '22023', null::text, 'no vende un producto en borrador');
select throws_ok(format($$select public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'cheque')$$, current_setting('t.store'), current_setting('t.v1')),
  '22023', null::text, 'valida el método de pago');
reset role;
select is((select quantity from commerce.inventory where variant_id = current_setting('t.v1')::uuid), 7, 'el stock bajó: 10 menos 3');

-- Anular: devuelve el stock; la venta con tarjeta de mostrador no genera reembolso en cola
select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.void_counter_sale(%L, 'abc')$$, current_setting('t.o2')), '22023', null::text, 'anular exige motivo');
select lives_ok(format($$select public.void_counter_sale(%L, 'el cliente se arrepintió')$$, current_setting('t.o2')), 'el cajero anula la venta con tarjeta');
reset role;
select is((select quantity from commerce.inventory where variant_id = current_setting('t.v1')::uuid), 8, 'anular devuelve el stock');
select is((select payment_status from sales.orders where id = current_setting('t.o2')::uuid), 'pagado', 'anular una venta de mostrador no pide reembolso por Stripe');
select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.void_counter_sale(%L, 'otra vez lo mismo')$$, current_setting('t.o2')), '22023', null::text, 'no se anula dos veces');

-- Aislamiento
reset role;
select tests.authenticate_as((select id from tu where k = 'caj2'));
select is((select count(*)::int from public.orders_list), 0, 'otro cajero no ve estas ventas');
select throws_ok(format($$select public.void_counter_sale(%L, 'intento ajeno')$$, current_setting('t.o1')), 'P0002', null::text, 'otro cajero no anula ventas ajenas');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*)::int from public.orders_list where channel = 'mostrador'), 2, 'el comercio ve las ventas de mostrador de su tienda');
reset role;

-- Cierre: esperado = 500 inicial + 380 en efectivo (la venta con tarjeta no suma y la anulada tampoco)
select tests.authenticate_as((select id from tu where k = 'caj'));
select is((select cash_expected from public.cash_sessions_list where id = current_setting('t.s1')::uuid), 880.00::numeric, 'efectivo esperado: 500 + 380');
select throws_ok($$select public.close_cash_session(870)$$, '22023', null::text, 'una diferencia exige explicación');
select is((select public.close_cash_session(870, 'faltan 10 de un vuelto mal dado') ->> 'difference'), '-10.00', 'cierra con diferencia de -10.00 y su nota');
select throws_ok(format($$select public.create_counter_sale(%L, '[{"variant_id":"%s","quantity":1}]'::jsonb, 'efectivo')$$, current_setting('t.store'), current_setting('t.v2')),
  '22023', null::text, 'con el turno cerrado no se vende');
select throws_ok(format($$select public.void_counter_sale(%L, 'fuera de turno')$$, current_setting('t.o1')), '22023', null::text, 'no se anula una venta de un turno cerrado');
select throws_ok($$select public.close_cash_session(0)$$, 'P0002', null::text, 'sin turno abierto no hay nada que cerrar');
reset role;

-- Administración ve los turnos y las ventas; la auditoría guarda la diferencia
select is(tests.count_as((select id from tu where k = 'adm'), 'public.cash_sessions_list'), 1::bigint, 'la administración ve los turnos de caja');
select ok(exists (select 1 from audit.events where action = 'cash_session.closed' and after_data ->> 'difference' = '-10.00'), 'el cierre queda auditado con su diferencia');

select * from finish();
rollback;
