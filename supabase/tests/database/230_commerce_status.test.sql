begin;
select plan(11);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.store')::uuid, (
  select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select is((select open_now from public.stores_list where id = current_setting('t.store')::uuid), true, 'con horario abierto, la tienda está abierta');
select throws_ok(format($$select public.set_commerce_status(%L, 'suspendido', 'intento propio')$$, (select id from tc where k = 'a')),
  '42501', null::text, 'el comercio no se suspende a sí mismo');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.set_commerce_status(%L, 'suspendido', 'abc')$$, (select id from tc where k = 'a')),
  '22023', null::text, 'el motivo exige 5 caracteres');
select lives_ok(format($$select public.set_commerce_status(%L, 'suspendido', 'incumplimiento del convenio')$$, (select id from tc where k = 'a')),
  'la administración suspende el comercio');
select throws_ok(format($$select public.set_commerce_status(%L, 'suspendido', 'otra vez lo mismo')$$, (select id from tc where k = 'a')),
  '22023', null::text, 'no repite el mismo estado');
select is((select open_now from public.stores_list where id = current_setting('t.store')::uuid), false,
  'con el comercio suspendido, la tienda no está abierta');
reset role;

select is(tests.count_as((select id from tu where k = 'com'), 'public.stores_list'), 0::bigint, 'el comercio suspendido pierde el acceso a sus datos');
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok(format($$select public.create_store(%L, 'Otra')$$, (select id from tc where k = 'a')), '42501', null::text,
  'el comercio suspendido no crea tiendas');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.set_commerce_status(%L, 'activo', 'convenio regularizado')$$, (select id from tc where k = 'a')),
  'la administración reactiva el comercio');
select is((select open_now from public.stores_list where id = current_setting('t.store')::uuid), true, 'al reactivar, la tienda vuelve a abrir');
reset role;

select ok(exists (select 1 from audit.events where action = 'commerce.status_changed' and reason = 'incumplimiento del convenio'),
  'el cambio queda auditado con su motivo');

select * from finish();
rollback;
