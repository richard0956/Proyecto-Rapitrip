begin;
select plan(15);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', tests.create_commerce('Comercio A'));

select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok($$select set_config('t.cat', public.create_master_item('categoria', 'Bebidas')::text, true)$$,
  'el admin crea una categoría');
select lives_ok(format($$select set_config('t.sub', public.create_master_item('categoria', 'Gaseosas', %L)::text, true)$$, current_setting('t.cat')),
  'crea una subcategoría');
select throws_ok(format($$select public.create_master_item('categoria', 'Light', %L)$$, current_setting('t.sub')),
  '22023', null::text, 'no admite un tercer nivel');
select throws_ok(format($$select public.create_master_item('marca', 'Coca', %L)$$, current_setting('t.cat')),
  '22023', null::text, 'solo las categorías tienen padre');
select throws_ok($$select public.create_master_item('bebida', 'Algo')$$, '22023', null::text, 'la clase se valida');
select throws_ok($$select public.create_master_item('categoria', 'bebidas')$$, '23505', null::text, 'el nombre no se repite');
select lives_ok($$select public.create_master_item('marca', 'Marca Uno')$$, 'crea una marca');
select lives_ok(format($$select public.rename_master_item(%L, 'Gaseosas y sodas')$$, current_setting('t.sub')), 'renombra');
select lives_ok(format($$select public.set_master_item_status(%L, 'inactivo', 'ya no se usa')$$, current_setting('t.cat')),
  'desactiva la categoría con motivo');
select is((select status from public.master_items_list where id = current_setting('t.sub')::uuid), 'inactivo',
  'la subcategoría se desactiva con su padre');
select throws_ok(format($$select public.set_master_item_status(%L, 'activo')$$, current_setting('t.sub')),
  '22023', null::text, 'no se activa una subcategoría con el padre inactivo');
reset role;

select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*)::int from public.master_items_list), 1, 'el comercio solo ve elementos activos');
select throws_ok($$select public.create_master_item('marca', 'Intrusa')$$, '42501', null::text, 'el comercio no escribe en el catálogo maestro');
reset role;

select is(tests.count_as((select id from tu where k = 'caj'), 'public.master_items_list'), 0::bigint, 'el cajero no ve el catálogo maestro');
select ok(exists (select 1 from audit.events where action = 'master_item.status_changed' and reason = 'ya no se usa'),
  'el cambio de estado queda auditado con su motivo');

select * from finish();
rollback;
