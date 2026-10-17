begin;
select plan(21);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'otro', tests.create_user('otro@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'otro'), 'comercio', (select id from tc where k = 'b'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select set_config('t.prod', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 4500)::text, true);

select is((select stock_state from public.inventory_list where variant_id = current_setting('t.var')::uuid), 'sin_control',
  'una variante nueva no controla stock');
select is((select available from public.inventory_list where variant_id = current_setting('t.var')::uuid), true, 'sin control siempre está disponible');
select throws_ok(format($$select public.add_stock(%L, 5, 'compra inicial')$$, current_setting('t.var')), '22023', null::text,
  'no se mueve stock sin activar el control');
select lives_ok(format($$select public.set_stock_tracking(%L, true, 3)$$, current_setting('t.var')), 'activa el control con umbral 3');
select is((select stock_state from public.inventory_list where variant_id = current_setting('t.var')::uuid), 'agotado', 'con control y 0 unidades está agotada');
select is((select available from public.inventory_list where variant_id = current_setting('t.var')::uuid), false, 'agotada no está disponible');

select is(public.add_stock(current_setting('t.var')::uuid, 10, 'compra inicial'), 10, 'la entrada devuelve la cantidad nueva');
select is((select stock_state from public.inventory_list where variant_id = current_setting('t.var')::uuid), 'disponible', 'con 10 y umbral 3 está disponible');
select is(public.remove_stock(current_setting('t.var')::uuid, 8, 'venta de mostrador'), 2, 'la salida descuenta');
select is((select stock_state from public.inventory_list where variant_id = current_setting('t.var')::uuid), 'bajo', 'con 2 y umbral 3 hay alerta de stock bajo');
select throws_ok(format($$select public.remove_stock(%L, 5, 'venta de mostrador')$$, current_setting('t.var')), '22023', null::text,
  'no deja el stock negativo');
select throws_ok(format($$select public.add_stock(%L, 5, 'abc')$$, current_setting('t.var')), '22023', null::text, 'el motivo exige 5 caracteres');
select throws_ok(format($$select public.add_stock(%L, 0, 'sin cantidad')$$, current_setting('t.var')), '22023', null::text, 'la cantidad debe ser positiva');
select is(public.count_stock(current_setting('t.var')::uuid, 20, 'conteo físico del lunes'), 20, 'el conteo fija la cantidad exacta');
select is((select array_agg(kind order by id) from public.stock_movements_list where variant_id = current_setting('t.var')::uuid),
  array['entrada', 'salida', 'conteo'], 'el historial conserva cada movimiento');
select is((select delta from public.stock_movements_list where kind = 'conteo' and variant_id = current_setting('t.var')::uuid), 18,
  'el conteo registra la diferencia');
reset role;

select tests.authenticate_as((select id from tu where k = 'otro'));
select is((select count(*)::int from public.inventory_list), 0, 'otro comercio no ve el inventario ajeno');
select throws_ok(format($$select public.add_stock(%L, 1, 'intento ajeno')$$, current_setting('t.var')), '42501', null::text,
  'otro comercio no mueve stock ajeno');
reset role;

select is(tests.count_as((select id from tu where k = 'caj'), 'public.inventory_list'), 0::bigint, 'el cajero no ve el inventario');
select is(tests.count_as((select id from tu where k = 'adm'), 'public.stock_movements_list'), 3::bigint, 'la administración ve los movimientos');
select ok(exists (select 1 from audit.events where action = 'inventory.salida' and after_data ->> 'quantity_after' = '2' and reason = 'venta de mostrador'),
  'cada movimiento queda auditado con su motivo');

select * from finish();
rollback;
