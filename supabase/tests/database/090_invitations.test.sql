begin;
select plan(22);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'sup', tests.create_user('sup@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'sup'), 'superadmin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');

select tests.authenticate_as((select id from tu where k = 'adm'));
select ok((public.create_invitation('Ana@X.com', 'cajero', repeat('a', 64)) ->> 'id') is not null,
  'el admin invita a un cajero');
reset role;
select ok((select expires_at between now() + interval '3 days 23 hours' and now() + interval '4 days 1 hour'
           from identity.invitations where token_hash = repeat('a', 64)),
  'la invitación vence a los 4 días');

select tests.authenticate_as((select id from tu where k = 'adm'));
select ok((public.create_invitation('ana@x.com', 'cajero', repeat('b', 64)) ->> 'id') is not null,
  'reinvitar con otras mayúsculas reemplaza la anterior');
reset role;
select is((select string_agg(status::text, ',' order by status::text) from identity.invitations where lower(email) = 'ana@x.com'),
  'cancelada,pendiente', 'queda una pendiente y la anterior cancelada');

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select public.create_invitation('otro@x.com', 'admin', repeat('c', 64))$$,
  '42501', null::text, 'el admin no invita admins');
select throws_ok($$select public.create_invitation('otro@x.com', 'comercio', repeat('c', 64))$$,
  '22023', null::text, 'el comercio no se asigna por invitación');
select throws_ok($$select public.create_invitation('otro@x.com', 'cajero', 'no-es-un-hash')$$,
  '22023', null::text, 'el hash del token debe ser SHA-256 en hexadecimal');
reset role;

select tests.authenticate_as((select id from tu where k = 'sup'));
select ok((public.create_invitation('root@x.com', 'admin', repeat('d', 64)) ->> 'id') is not null,
  'el superadmin invita a un admin');
reset role;

select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok($$select public.create_invitation('otro@x.com', 'cajero', repeat('e', 64))$$,
  '42501', null::text, 'el cajero no invita');
reset role;

-- aceptar (servidor)
select set_config('role', 'service_role', true);
select is((public.begin_accept_invitation(repeat('b', 64)) ->> 'ok')::boolean, true, 'la invitación pendiente se puede aceptar');
select is(public.begin_accept_invitation(repeat('b', 64)) ->> 'email', 'ana@x.com', 'el correo se normaliza a minúsculas');
select is(public.begin_accept_invitation(repeat('9', 64)) ->> 'reason', 'invalida', 'un token desconocido es inválido');
reset role;

insert into tu select 'ana', tests.create_user('ana@x.com', 'Ana');
select set_config('role', 'service_role', true);
select is(public.finish_accept_invitation(repeat('b', 64), (select id from tu where k = 'ana')),
  true, 'se completa la aceptación');
reset role;
select ok(exists (select 1 from identity.user_roles ur join identity.profile_pii pii on pii.user_id = ur.user_id
                  where pii.email = 'ana@x.com' and ur.role = 'cajero' and ur.status = 'activo'),
  'la cuenta recibe el rol invitado');
select is((select status::text from identity.invitations where token_hash = repeat('b', 64)), 'aceptada',
  'la invitación queda aceptada');

select set_config('role', 'service_role', true);
select is(public.begin_accept_invitation(repeat('b', 64)) ->> 'reason', 'no_disponible', 'un token no se reutiliza');
reset role;

-- vencimiento
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok($$select public.create_invitation('exp@x.com', 'coordinador', repeat('f', 64))$$, 'invitación para vencer');
reset role;
update identity.invitations set expires_at = now() - interval '1 day' where token_hash = repeat('f', 64);
select set_config('role', 'service_role', true);
select is(public.begin_accept_invitation(repeat('f', 64)) ->> 'reason', 'vencida', 'una invitación vencida se rechaza');
reset role;
select is((select status::text from identity.invitations where token_hash = repeat('f', 64)), 'vencida',
  'y queda marcada como vencida');

select set_config('role', 'service_role', true);
select is(public.lookup_auth_user('ANA@x.com') ->> 'has_password', 'false', 'lookup encuentra la cuenta sin importar mayúsculas');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select public.begin_accept_invitation(repeat('b', 64))$$, '42501', null::text,
  'authenticated no puede aceptar invitaciones');
select throws_ok($$select public.create_invitation('ana@x.com', 'cajero', repeat('1', 64))$$, '23505', null::text,
  'no se invita a quien ya tiene el rol');
reset role;

select * from finish();
rollback;