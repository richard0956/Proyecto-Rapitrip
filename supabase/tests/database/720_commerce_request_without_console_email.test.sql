-- La solicitud de afiliación se envía sin el correo de la consola; lo escribe el administrador al aprobar (migración 98).
begin;
select plan(5);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli', tests.create_user('cli720@t.test');
insert into tu select 'adm', tests.create_user('adm720@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');

select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
select lives_ok($$select set_config('t.req', public.submit_commerce_request('Tienda Sin Correo', '{"contact_name":"Ana","phone":"88881234"}')::text, true)$$,
  'se puede solicitar sin correo de consola');
reset role;
select is((select details ? 'console_email' from identity.commerce_requests where id = current_setting('t.req')::uuid), false, 'la solicitud queda sin ese dato');

-- La aprobación sin correo falla con un mensaje claro; con el correo que escribe el administrador, avanza.
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.approve_commerce_request(%L, true, repeat('a', 64))$$, current_setting('t.req')), '22023', null::text,
  'aprobar sin correo de consola pide escribirlo');
select lives_ok(format($$select public.approve_commerce_request(%L, true, repeat('a', 64), 'Dueno720@T.test')$$, current_setting('t.req')),
  'el administrador escribe el correo al aprobar');
reset role;
select is((select details ->> 'console_email' from identity.commerce_requests where id = current_setting('t.req')::uuid), 'dueno720@t.test',
  'queda guardado en minúsculas en la solicitud aprobada');

select * from finish();
rollback;
