begin;
select plan(18);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm',  tests.create_user('adm@t.test');
insert into tu select 'adm2', tests.create_user('adm2@t.test');
insert into tu select 'sup',  tests.create_user('sup@t.test');
insert into tu select 'caj',  tests.create_user('caj@t.test');
insert into tu select 'com',  tests.create_user('com@t.test');
insert into tu select 'cli',  tests.create_user('cli@t.test');
insert into tu select 'boot', tests.create_user('boot@t.test');

select tests.grant_role((select id from tu where k = 'adm'),  'admin');
select tests.grant_role((select id from tu where k = 'adm2'), 'admin');
select tests.grant_role((select id from tu where k = 'sup'),  'superadmin');
select tests.grant_role((select id from tu where k = 'caj'),  'cajero');
select tests.grant_role((select id from tu where k = 'com'),  'comercio', tests.create_commerce('C1'));

-- admin suspende y reactiva cajero
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.suspend_role(%L, 'cajero', 'motivo de prueba')$$, (select id from tu where k = 'caj')),
  'admin suspende un cajero');
reset role;
select is((select status::text from identity.user_roles where user_id = (select id from tu where k = 'caj') and role = 'cajero'),
  'suspendido', 'el rol queda suspendido');
select ok(exists (select 1 from audit.events where action = 'role.suspended'
  and actor_id = (select id from tu where k = 'adm')), 'la suspensión queda en la auditoría');

select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.reactivate_role(%L, 'cajero', 'ya aclarado')$$, (select id from tu where k = 'caj')),
  'admin reactiva el cajero');
reset role;
select is((select status::text from identity.user_roles where user_id = (select id from tu where k = 'caj') and role = 'cajero'),
  'activo', 'el rol vuelve a activo');

-- límites de la matriz
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.suspend_role(%L, 'admin', 'motivo de prueba')$$, (select id from tu where k = 'adm2')),
  '42501', null::text, 'admin no gestiona a otro admin');
select throws_ok(format($$select public.suspend_role(%L, 'superadmin', 'motivo de prueba')$$, (select id from tu where k = 'sup')),
  '42501', null::text, 'nadie gestiona al superadmin por la API');
select throws_ok(format($$select public.suspend_role(%L, 'cajero', 'motivo de prueba')$$, (select id from tu where k = 'adm')),
  '42501', null::text, 'nadie gestiona sus propios roles');
select throws_ok(format($$select public.suspend_role(%L, 'cajero', 'ok')$$, (select id from tu where k = 'caj')),
  '22023', null::text, 'el motivo es obligatorio (mínimo 5 caracteres)');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'), 'aal1');
select throws_ok(format($$select public.suspend_role(%L, 'cajero', 'motivo de prueba')$$, (select id from tu where k = 'caj')),
  '42501', null::text, 'con aal1 no se gestionan roles');
reset role;

select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.suspend_role(%L, 'cliente', 'motivo de prueba')$$, (select id from tu where k = 'cli')),
  '42501', null::text, 'el cajero no gestiona roles');
reset role;

select tests.authenticate_as((select id from tu where k = 'sup'));
select lives_ok(format($$select public.suspend_role(%L, 'admin', 'motivo de prueba')$$, (select id from tu where k = 'adm2')),
  'superadmin suspende a un admin');
reset role;

-- revocar es definitivo; el comercio también se gestiona
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.revoke_role(%L, 'cajero', 'baja del personal')$$, (select id from tu where k = 'caj')),
  'admin revoca el cajero');
select throws_ok(format($$select public.reactivate_role(%L, 'cajero', 'intento de volver')$$, (select id from tu where k = 'caj')),
  'P0002', null::text, 'un rol revocado no se reactiva');
reset role;

-- bootstrap del superadmin
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.bootstrap_superadmin(%L)$$, (select id from tu where k = 'boot')),
  '42501', null::text, 'authenticated no puede crear superadmins');
reset role;

select set_config('role', 'service_role', true);
select lives_ok(format($$select public.bootstrap_superadmin(%L)$$, (select id from tu where k = 'boot')),
  'service_role siembra al superadmin');
select lives_ok(format($$select public.bootstrap_superadmin(%L)$$, (select id from tu where k = 'boot')),
  'sembrarlo otra vez no falla');
reset role;
select is((select count(*) from identity.user_roles
  where user_id = (select id from tu where k = 'boot') and role = 'superadmin'),
  1::bigint, 'sembrarlo dos veces no duplica el rol');

select * from finish();
rollback;