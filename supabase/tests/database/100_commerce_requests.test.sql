begin;
select plan(22);

delete from private.email_outbox;  -- no depender de correos que haya dejado una prueba manual

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli1', tests.create_user('cli1@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
insert into tu select 'cli3', tests.create_user('cli3@t.test');
insert into tu select 'adm',  tests.create_user('adm@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
update auth.users set email_confirmed_at = null where id = (select id from tu where k = 'cli3');

-- Enviar: el correo de la consola es opcional (lo escribe el administrador al aprobar); si viene, es otra cuenta y otro correo (Zero Trust).
select tests.authenticate_as((select id from tu where k = 'cli1'), 'aal1');
select throws_ok($$select public.submit_commerce_request('Tienda Uno', '{"nota":"x","console_email":"no-es-un-correo"}')$$, '22023', null::text,
  'si se manda el correo de la consola, debe estar bien escrito');
select throws_ok($$select public.submit_commerce_request('Tienda Uno', '{"console_email":"CLI1@t.test"}')$$, '22023', null::text,
  'el correo de la consola no puede ser el de la cuenta de la tienda');
select lives_ok($$select set_config('t.req1', public.submit_commerce_request('Tienda Uno', '{"nota":"x","console_email":"Negocio1@t.test"}')::text, true)$$,
  'un cliente solicita la afiliación');
select throws_ok($$select public.submit_commerce_request('Tienda Uno bis', '{"console_email":"otro1@t.test"}')$$, '23505', null::text,
  'no se admiten dos solicitudes pendientes');
reset role;
select is((select details ->> 'console_email' from identity.commerce_requests where id = current_setting('t.req1')::uuid),
  'negocio1@t.test', 'el correo de la consola se guarda en minúsculas');

select tests.authenticate_as((select id from tu where k = 'cli3'), 'aal1');
select throws_ok($$select public.submit_commerce_request('Tienda Tres', '{"console_email":"negocio3@t.test"}')$$, '42501', null::text,
  'sin correo verificado no se puede solicitar');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli2'), 'aal1');
select ok(public.submit_commerce_request('Tienda Dos', '{"console_email":"negocio2@t.test"}') is not null, 'otro cliente también solicita');
reset role;

-- Aprobar: nace el comercio y una invitación a su cuenta de consola; la cuenta de la tienda no cambia.
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.approve_commerce_request(%L, false, %L)$$, current_setting('t.req1'), repeat('a', 64)),
  '22023', null::text, 'aprobar exige confirmar el convenio firmado');
select lives_ok(format($$select public.approve_commerce_request(%L, true, %L)$$, current_setting('t.req1'), repeat('a', 64)),
  'el admin aprueba la solicitud');
reset role;

select ok(not exists (select 1 from identity.user_roles where user_id = (select id from tu where k = 'cli1') and role = 'comercio'),
  'la cuenta de la tienda no recibe el rol comercio');
select ok(exists (
  select 1 from identity.invitations i join identity.commerces c on c.id = i.commerce_id
  where i.email = 'negocio1@t.test' and i.role = 'comercio' and i.status = 'pendiente' and c.name = 'Tienda Uno'),
  'se crean el comercio y la invitación a su correo de consola');
select ok(exists (select 1 from private.email_outbox where template = 'commerce_approved' and to_email = 'cli1@t.test'),
  'se encola el correo de aprobación al solicitante');
select is((select status::text from identity.commerce_requests where id = current_setting('t.req1')::uuid),
  'aprobada', 'la solicitud queda aprobada');

-- Aceptar la invitación con una cuenta de consola nueva deja el comercio con su dueño.
insert into tu select 'neg1', tests.create_app_user('negocio1@t.test', 'consola');
select set_config('role', 'service_role', true);
select is(public.finish_accept_invitation(repeat('a', 64), (select id from tu where k = 'neg1')), true,
  'la cuenta de consola acepta la invitación del comercio');
reset role;
select ok(exists (select 1 from identity.user_roles ur join identity.commerces c on c.id = ur.commerce_id
                  where ur.user_id = (select id from tu where k = 'neg1') and ur.role = 'comercio' and c.name = 'Tienda Uno'),
  'y recibe el rol comercio de ese comercio');

select tests.authenticate_as((select id from tu where k = 'cli1'));
select throws_ok(format($$select public.approve_commerce_request(%L, true, %L)$$,
  (select id from identity.commerce_requests where requester_id = (select id from tu where k = 'cli2')), repeat('b', 64)),
  '42501', null::text, 'un cliente no aprueba solicitudes');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.reject_commerce_request(%L, 'corto')$$,
  (select id from identity.commerce_requests where requester_id = (select id from tu where k = 'cli2'))),
  '22023', null::text, 'rechazar exige un motivo de al menos 10 caracteres');
select lives_ok(format($$select public.reject_commerce_request(%L, 'Falta el convenio firmado')$$,
  (select id from identity.commerce_requests where requester_id = (select id from tu where k = 'cli2'))),
  'el admin rechaza con motivo');
reset role;
select ok(exists (select 1 from private.email_outbox where template = 'commerce_rejected' and to_email = 'cli2@t.test'),
  'se encola el correo de rechazo');

-- Tras un rechazo se vuelve a solicitar; si el correo de la consola ya es una cuenta, no se aprueba.
select tests.authenticate_as((select id from tu where k = 'cli2'), 'aal1');
select lives_ok($$select public.submit_commerce_request('Tienda Dos corregida', '{"console_email":"cli1@t.test"}')$$,
  'tras un rechazo se puede volver a solicitar de inmediato');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.approve_commerce_request(%L, true, %L)$$,
  (select id from identity.commerce_requests where requester_id = (select id from tu where k = 'cli2') and status = 'pendiente'), repeat('c', 64)),
  '23505', null::text, 'el correo de la consola no puede ser de una cuenta que ya existe');
select throws_ok($$select public.submit_commerce_request('Negocio del admin', '{"console_email":"negocio9@t.test"}')$$, '42501', null::text,
  'una cuenta de consola no solicita afiliaciones');
reset role;

select * from finish();
rollback;
