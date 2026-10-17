begin;
select plan(9);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli1', tests.create_user('cli1@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');

select tests.authenticate_as((select id from tu where k = 'cli1'), 'aal1');
select lives_ok($$select public.submit_commerce_request('Ferretería El Clavo',
  '{"contact_name":"Juan Téllez","phone":"+505 8456 2210","address":"Bo. Altagracia","category":"Ferretería"}')$$,
  'el cliente envía la solicitud con sus datos');
reset role;

-- El cliente ve el estado de su solicitud
select is(tests.count_as((select id from tu where k = 'cli1'), 'public.my_commerce_requests', 'aal1'), 1::bigint,
  'el cliente ve su solicitud');
select tests.authenticate_as((select id from tu where k = 'cli1'), 'aal1');
select is((select status::text from public.my_commerce_requests), 'pendiente', 'y su estado');
select ok(not exists (select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'my_commerce_requests' and column_name = 'details'),
  'la vista del cliente no devuelve el detalle');
reset role;

-- Otro cliente no la ve
select is(tests.count_as((select id from tu where k = 'cli2'), 'public.my_commerce_requests', 'aal1'), 0::bigint,
  'otro cliente no ve solicitudes ajenas');

-- Con la sesión vencida (más de un día) no se ve nada
select tests.age_session((select id from tu where k = 'cli1'), '25 hours');
select is(tests.count_as((select id from tu where k = 'cli1'), 'public.my_commerce_requests', 'aal1'), 0::bigint,
  'con la sesión vencida la vista queda vacía');

-- La consola ve los datos del solicitante; quien no es administrador, no
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select details ->> 'category' from public.commerce_requests_list limit 1), 'Ferretería',
  'el administrador ve los datos enviados');
reset role;
select is(tests.count_as((select id from tu where k = 'coo'), 'public.commerce_requests_list'), 0::bigint,
  'el coordinador no ve solicitudes de comercio');
select is(tests.count_as_anon('public.my_commerce_requests'), -1::bigint, 'anon no accede a la vista del cliente');

select * from finish();
rollback;
