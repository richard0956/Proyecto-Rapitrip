begin;
select plan(17);

delete from private.email_outbox;  -- no depender de correos que haya dejado una prueba manual

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli1', tests.create_user('cli1@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
insert into tu select 'cli3', tests.create_user('cli3@t.test');
insert into tu select 'adm',  tests.create_user('adm@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
update auth.users set email_confirmed_at = null where id = (select id from tu where k = 'cli3');

select tests.authenticate_as((select id from tu where k = 'cli1'), 'aal1');
select lives_ok($$select set_config('t.req1', public.submit_commerce_request('Tienda Uno', '{"nota":"x"}')::text, true)$$,
  'un cliente solicita la afiliación');
select throws_ok($$select public.submit_commerce_request('Tienda Uno bis')$$, '23505', null::text,
  'no se admiten dos solicitudes pendientes');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli3'), 'aal1');
select throws_ok($$select public.submit_commerce_request('Tienda Tres')$$, '42501', null::text,
  'sin correo verificado no se puede solicitar');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli2'), 'aal1');
select ok(public.submit_commerce_request('Tienda Dos') is not null, 'otro cliente también solicita');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.approve_commerce_request(%L, false)$$, current_setting('t.req1')),
  '22023', null::text, 'aprobar exige confirmar el convenio firmado');
select lives_ok(format($$select public.approve_commerce_request(%L, true)$$, current_setting('t.req1')),
  'el admin aprueba la solicitud');
reset role;

select ok(exists (
  select 1 from identity.user_roles ur join identity.commerces c on c.id = ur.commerce_id
  where ur.user_id = (select id from tu where k = 'cli1') and ur.role = 'comercio'
    and ur.status = 'activo' and c.name = 'Tienda Uno'),
  'se crean el comercio y el rol comercio para el solicitante');
select ok(exists (select 1 from private.email_outbox where template = 'commerce_approved' and to_email = 'cli1@t.test'),
  'se encola el correo de aprobación');
select is((select status::text from identity.commerce_requests where id = current_setting('t.req1')::uuid),
  'aprobada', 'la solicitud queda aprobada');

select tests.authenticate_as((select id from tu where k = 'cli1'));
select throws_ok(format($$select public.approve_commerce_request(%L, true)$$,
  (select id from identity.commerce_requests where requester_id = (select id from tu where k = 'cli2'))),
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

select tests.authenticate_as((select id from tu where k = 'cli2'), 'aal1');
select lives_ok($$select public.submit_commerce_request('Tienda Dos corregida')$$,
  'tras un rechazo se puede volver a solicitar de inmediato');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli1'), 'aal1');
select throws_ok($$select public.submit_commerce_request('Otro negocio')$$, '23505', null::text,
  'quien ya tiene un comercio no solicita otro');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select ok(public.submit_commerce_request('Negocio del admin') is not null, 'un admin también puede solicitar como cliente');
select throws_ok(format($$select public.approve_commerce_request(%L, true)$$,
  (select id from identity.commerce_requests where requester_id = (select id from tu where k = 'adm'))),
  '42501', null::text, 'nadie aprueba su propia solicitud');
reset role;

select * from finish();
rollback;