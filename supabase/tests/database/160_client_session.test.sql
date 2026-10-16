begin;
select plan(9);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli', tests.create_user('cli@t.test', 'Cliente Uno');

-- Sesión nueva
select is(tests.count_as((select id from tu where k = 'cli'), 'public.my_profile', 'aal1'), 1::bigint,
  'una sesión nueva ve su perfil');

-- 23 horas: sigue valiendo
select tests.age_session((select id from tu where k = 'cli'), '23 hours');
select is(tests.count_as((select id from tu where k = 'cli'), 'public.my_profile', 'aal1'), 1::bigint,
  'una sesión de 23 horas sigue valiendo');

-- 25 horas: vencida
select tests.age_session((select id from tu where k = 'cli'), '25 hours');
select is(tests.count_as((select id from tu where k = 'cli'), 'public.my_profile', 'aal1'), 0::bigint,
  'una sesión de 25 horas ya no ve su perfil');
select is(tests.count_as((select id from tu where k = 'cli'), 'public.my_roles', 'aal1'), 0::bigint,
  'ni sus roles');

select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
select throws_ok($$select public.update_my_profile('Nombre Nuevo', '88881234')$$, '42501', null::text,
  'con la sesión vencida no se edita el perfil');
select throws_ok($$select public.submit_commerce_request('Tienda Uno')$$, '42501', null::text,
  'con la sesión vencida no se solicita un comercio');
reset role;

-- Sesión rejuvenecida: vuelve a valer
select tests.age_session((select id from tu where k = 'cli'), '1 hour');
select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
select lives_ok($$select public.update_my_profile('Nombre Nuevo', '88881234')$$,
  'con una sesión vigente sí se edita el perfil');
reset role;

-- Cerrar sesión borra la fila en auth.sessions: el token que siga vivo deja de valer
select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
reset role;
delete from auth.sessions where id = (select id from tu where k = 'cli');
select set_config('role', 'authenticated', true);
select is((select count(*) from public.my_profile), 0::bigint,
  'una sesión cerrada deja de valer aunque el token no haya vencido');
reset role;

-- Sin session_id en el token no hay sesión válida
select tests.set_claims((select id from tu where k = 'cli'), 'aal1');
select set_config('request.jwt.claims', (private.jwt_claims() - 'session_id')::text, true);
select is(private.has_valid_session(), false, 'un token sin session_id no es una sesión válida');

select * from finish();
rollback;