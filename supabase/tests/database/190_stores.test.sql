begin;
select plan(21);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'otro', tests.create_user('otro@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'otro'), 'comercio', (select id from tc where k = 'b'));

-- El comercio crea y edita sus tiendas
select tests.authenticate_as((select id from tu where k = 'com'));
select lives_ok(format($$select set_config('t.store', public.create_store(%L, 'Sucursal Centro', 'Av. 2', '22223333')::text, true)$$,
  (select id from tc where k = 'a')), 'el comercio crea una tienda propia');
select throws_ok(format($$select public.create_store(%L, 'Intrusa')$$, (select id from tc where k = 'b')),
  '42501', null::text, 'no crea tiendas en otro comercio');
select throws_ok(format($$select public.create_store(%L, 'sucursal centro')$$, (select id from tc where k = 'a')),
  '23505', null::text, 'el nombre no se repite dentro del comercio');
select throws_ok(format($$select public.create_store(%L, 'X', null, 'abc')$$, (select id from tc where k = 'a')),
  '22023', null::text, 'se valida el nombre y el teléfono');
select lives_ok(format($$select public.update_store(%L, 'Sucursal Centro', 'Av. 3', '22223333')$$, current_setting('t.store')),
  'el comercio edita su tienda');
reset role;

-- Horario semanal y apertura
select tests.authenticate_as((select id from tu where k = 'com'));
select lives_ok(format($$select public.set_store_hours(%L, jsonb_build_array(
  jsonb_build_object('weekday', 0, 'opens', '00:00', 'closes', '23:59'),
  jsonb_build_object('weekday', 1, 'opens', '00:00', 'closes', '23:59'),
  jsonb_build_object('weekday', 2, 'opens', '00:00', 'closes', '23:59'),
  jsonb_build_object('weekday', 3, 'opens', '00:00', 'closes', '23:59'),
  jsonb_build_object('weekday', 4, 'opens', '00:00', 'closes', '23:59'),
  jsonb_build_object('weekday', 5, 'opens', '00:00', 'closes', '23:59'),
  jsonb_build_object('weekday', 6, 'opens', '00:00', 'closes', '23:59')))$$, current_setting('t.store')),
  'el comercio define su horario');
select is((select open_now from public.stores_list where id = current_setting('t.store')::uuid), true,
  'abierta dentro del horario');
select throws_ok(format($$select public.set_store_hours(%L, '[{"weekday":1,"opens":"10:00","closes":"12:00"},{"weekday":1,"opens":"11:00","closes":"13:00"}]'::jsonb)$$, current_setting('t.store')),
  '22023', null::text, 'los tramos del mismo día no se traslapan');
select throws_ok(format($$select public.set_store_hours(%L, '[{"weekday":9,"opens":"10:00","closes":"12:00"}]'::jsonb)$$, current_setting('t.store')),
  '22023', null::text, 'el día de la semana se valida');
select is((select count(*)::int from public.store_hours_list where store_id = current_setting('t.store')::uuid), 7,
  'un horario inválido no deja cambios (el anterior se conserva)');

-- Cierre temporal y excepciones
select lives_ok(format($$select public.close_store_temporarily(%L, now() + interval '2 days', 'inventario')$$, current_setting('t.store')),
  'cierre temporal con fecha futura');
select is((select open_now from public.stores_list where id = current_setting('t.store')::uuid), false,
  'cerrada temporalmente no está abierta');
select throws_ok(format($$select public.close_store_temporarily(%L, now() - interval '1 day')$$, current_setting('t.store')),
  '22023', null::text, 'la reapertura debe ser futura');
select lives_ok(format($$select public.reopen_store(%L)$$, current_setting('t.store')), 'se reabre a mano');
select lives_ok(format($$select public.set_store_exception(%L, current_date, true, null, null, 'feriado')$$, current_setting('t.store')),
  'excepción de cierre para hoy');
select is((select open_now from public.stores_list where id = current_setting('t.store')::uuid), false,
  'la excepción de hoy manda sobre el horario');
reset role;

-- Aislamiento
select tests.authenticate_as((select id from tu where k = 'otro'));
select is((select count(*)::int from public.stores_list), 0, 'otro comercio no ve tiendas ajenas');
select throws_ok(format($$select public.set_store_status(%L, 'inactiva', 'sin motivo real')$$, current_setting('t.store')),
  '42501', null::text, 'otro comercio no modifica tiendas ajenas');
reset role;
select is(tests.count_as((select id from tu where k = 'adm'), 'public.stores_list'), 1::bigint, 'la administración ve todas las tiendas');
select is(tests.count_as((select id from tu where k = 'caj'), 'public.stores_list'), 0::bigint, 'el cajero no ve la gestión de tiendas');

-- Auditoría sin valores personales
select ok(exists (select 1 from audit.events where action = 'store.updated' and after_data -> 'changed_fields' @> '["address"]'::jsonb),
  'la auditoría de tiendas guarda el campo cambiado');

select * from finish();
rollback;
