begin;
select plan(23);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
insert into tu select 'sus', tests.create_user('sus@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
create temp table tc (k text primary key, id uuid);
insert into tc select 'c1', tests.create_commerce('C1');
insert into tc select 'c2', tests.create_commerce('C2');

select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'sus'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'c1'));
update identity.user_roles set status = 'suspendido'
  where user_id = (select id from tu where k = 'sus') and role = 'cajero';

-- has_role
select tests.set_claims((select id from tu where k = 'adm'));
select is(private.has_role('admin'), true, 'admin activo tiene el rol admin');
select is(private.has_role('cajero'), false, 'admin no tiene el rol cajero');
select tests.set_claims((select id from tu where k = 'sus'));
select is(private.has_role('cajero'), false, 'un rol suspendido no cuenta');
select tests.set_claims((select id from tu where k = 'com'));
select is(private.has_role('comercio', (select id from tc where k = 'c1')), true, 'el comercio ve su alcance');
select is(private.has_role('comercio', (select id from tc where k = 'c2')), false, 'no tiene alcance sobre otro comercio');
update identity.commerces set status = 'suspendido' where id = (select id from tc where k = 'c1');
select is(private.has_role('comercio'), false, 'comercio suspendido: la cuenta pierde el rol operativo');

-- matriz
select results_eq(
  $$ select manager::text, target::text from private.role_management order by 1, 2 $$,
  $$ values ('admin','cajero'), ('admin','cliente'), ('admin','comercio'), ('admin','coordinador'),
            ('superadmin','admin'), ('superadmin','cajero'), ('superadmin','cliente'),
            ('superadmin','comercio'), ('superadmin','coordinador') $$,
  'la matriz de gestión coincide con la acordada');
select is(private.role_can_manage('admin', 'admin'), false, 'admin no gestiona admin');
select is(private.role_can_manage('superadmin', 'admin'), true, 'superadmin gestiona admin');
select is(private.role_can_manage('cajero', 'cliente'), false, 'cajero no gestiona a nadie');

select tests.set_claims((select id from tu where k = 'adm'));
select is(private.can_manage('cajero'), true, 'admin gestiona cajero');
select is(private.can_manage('admin'), false, 'admin no gestiona admin (RF-IDA-03)');
select tests.set_claims((select id from tu where k = 'caj'));
select is(private.can_manage('cajero'), false, 'cajero no gestiona roles');

-- sesión fuerte
select tests.touch((select id from tu where k = 'adm'));
select tests.set_claims((select id from tu where k = 'adm'));
select is(private.has_strong_session(), true, 'password + aal2 + actividad reciente');
select tests.set_claims((select id from tu where k = 'adm'), 'aal1');
select is(private.has_strong_session(), false, 'aal1 no es sesión fuerte');
select tests.set_claims((select id from tu where k = 'adm'), 'aal2',
  '[{"method":"totp","timestamp":2},{"method":"oauth","timestamp":1}]'::jsonb);
select is(private.has_strong_session(), false, 'aal2 sin método password (Google + TOTP) no es sesión fuerte');
select tests.touch((select id from tu where k = 'adm'), '16 minutes');
select tests.set_claims((select id from tu where k = 'adm'));
select is(private.has_strong_session(), false, 'más de 15 minutos sin actividad');
select tests.touch((select id from tu where k = 'adm'));
select set_config('request.jwt.claims', (private.jwt_claims() - 'session_id')::text, true);
select is(private.has_strong_session(), false, 'sin session_id no hay sesión fuerte');
select tests.set_claims((select id from tu where k = 'cli'));
select is(private.has_strong_session(), false, 'sin registro de actividad no hay sesión fuerte');

-- touch_session
select tests.set_claims((select id from tu where k = 'adm'));
select public.touch_session();
select is((select last_activity_at from private.session_activity where session_id = (select id from tu where k = 'adm')),
  now(), 'touch_session registra la actividad');
select tests.authenticate_as_anon();
select throws_ok($$select public.touch_session()$$, '42501', null::text, 'anon no puede llamar touch_session');
reset role;

-- MFA reciente
select tests.set_claims((select id from tu where k = 'adm'));
select is(private.has_recent_mfa(5), true, 'TOTP reciente');
select tests.set_claims((select id from tu where k = 'adm'), 'aal2',
  jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - 3600),
                    jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint - 3700)));
select is(private.has_recent_mfa(5), false, 'TOTP de hace una hora no es reciente');

select * from finish();
rollback;