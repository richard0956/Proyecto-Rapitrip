begin;
select plan(36);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');

create temp table tc (k text primary key, id uuid);
grant select on tc to public;
select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.a', public.create_courier('Rep Ana', '88881111', 'moto')::text, true);
select set_config('t.b', public.create_courier('Rep Beto', '88882222', 'moto')::text, true);
reset role;
insert into tc values ('a', current_setting('t.a')::uuid), ('b', current_setting('t.b')::uuid);

-- Invitar -------------------------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'adm'));
select ok((public.create_courier_invitation((select id from tc where k = 'a'), 'Ana@Rep.com', repeat('a', 64)) ->> 'id') is not null,
  'el admin invita a un repartidor desde su ficha');
select throws_ok($$select public.create_invitation('x@rep.com', 'repartidor', repeat('c', 64))$$, '22023', null::text,
  'la invitación genérica no otorga el rol repartidor');
select throws_ok(format($$select public.create_courier_invitation(%L, 'no-es-correo', repeat('c', 64))$$, (select id from tc where k = 'a')),
  '22023', null::text, 'el correo debe ser válido');
select throws_ok(format($$select public.create_courier_invitation(%L, 'x@rep.com', 'no-es-hash')$$, (select id from tc where k = 'a')),
  '22023', null::text, 'el hash del token debe ser SHA-256');
select throws_ok($$select public.create_courier_invitation(gen_random_uuid(), 'x@rep.com', repeat('c', 64))$$, 'P0002', null::text,
  'la ficha debe existir');
select ok((public.create_courier_invitation((select id from tc where k = 'a'), 'ana@rep.com', repeat('b', 64)) ->> 'id') is not null,
  'reinvitar reemplaza la invitación pendiente');
reset role;
select is((select string_agg(status::text, ',' order by status::text) from identity.invitations where courier_id = (select id from tc where k = 'a')),
  'cancelada,pendiente', 'queda una sola pendiente por ficha');

select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.create_courier_invitation(%L, 'x@rep.com', repeat('d', 64))$$, (select id from tc where k = 'a')),
  '42501', null::text, 'el cajero no invita repartidores');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.create_courier_invitation(%L, 'x@rep.com', repeat('d', 64))$$, (select id from tc where k = 'a')),
  '42501', null::text, 'el coordinador no invita repartidores');
reset role;

-- Aceptar: crea el rol y vincula la ficha ---------------------------------------------------------------------------------
insert into tu select 'ana', tests.create_user('ana@rep.com', 'Ana Repartidora');
select set_config('role', 'service_role', true);
select is((public.begin_accept_invitation(repeat('b', 64)) ->> 'role'), 'repartidor', 'la invitación pendiente es de repartidor');
select is(public.finish_accept_invitation(repeat('b', 64), (select id from tu where k = 'ana')), true, 'se completa la aceptación');
reset role;
select is((select user_id from identity.couriers where id = (select id from tc where k = 'a')), (select id from tu where k = 'ana'),
  'la ficha queda vinculada a la cuenta');
select ok(exists (select 1 from identity.user_roles where user_id = (select id from tu where k = 'ana') and role = 'repartidor' and status = 'activo'),
  'la cuenta recibe el rol repartidor');
select ok(exists (select 1 from audit.events where action = 'courier.account_linked'), 'el vínculo queda auditado');

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.create_courier_invitation(%L, 'otra@rep.com', repeat('e', 64))$$, (select id from tc where k = 'a')),
  '23505', null::text, 'una ficha con cuenta no se invita de nuevo');
select throws_ok(format($$select public.create_courier_invitation(%L, 'ana@rep.com', repeat('f', 64))$$, (select id from tc where k = 'b')),
  '23505', null::text, 'no se invita a un correo que ya es repartidor');
reset role;
-- Defensa en la aceptación: aunque exista una invitación así (creada por otra vía), la cuenta ya vinculada no la acepta.
insert into identity.invitations (email, role, courier_id, invited_by, token_hash, expires_at)
values ('ana@rep.com', 'repartidor', (select id from tc where k = 'b'), (select id from tu where k = 'adm'), repeat('f', 64), now() + interval '1 day');
select set_config('role', 'service_role', true);
select is(public.finish_accept_invitation(repeat('f', 64), (select id from tu where k = 'ana')), false,
  'una cuenta ya vinculada no acepta otra ficha');
reset role;

-- Sesión del repartidor ---------------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'ana'), 'aal1');
select is(private.is_courier_session(), true, 'el repartidor vinculado tiene sesión de repartidor sin segundo factor');
select is((select count(*) from public.courier_me), 1::bigint, 'courier_me devuelve su propia ficha');
select is((select count(*) from public.couriers_list), 1::bigint, 'solo ve su propia ficha en la lista de repartidores');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
select is(private.is_courier_session(), false, 'un cliente no tiene sesión de repartidor');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select count(*) from public.courier_me), 0::bigint, 'courier_me no devuelve nada a otros roles');
reset role;
select tests.age_session((select id from tu where k = 'ana'), interval '13 hours');
select tests.authenticate_as((select id from tu where k = 'ana'), 'aal1');
select is(private.is_courier_session(), false, 'la sesión vence a las 12 horas');
reset role;
select tests.age_session((select id from tu where k = 'ana'), interval '1 hour');

-- Disponibilidad ----------------------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'ana'), 'aal1');
select lives_ok($$select public.courier_set_available(true)$$, 'el repartidor se marca disponible');
select lives_ok($$select public.courier_set_available(true)$$, 'repetirlo no falla (idempotente)');
select is((select available from public.courier_me), true, 'queda disponible');
reset role;
select is((select count(*) from audit.events where action = 'courier.availability_changed'), 1::bigint,
  'repetir el mismo valor no vuelve a auditar');
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok($$select public.courier_set_available(true)$$, '42501', null::text, 'otro rol no cambia la disponibilidad');
reset role;

-- Desactivar la ficha y revocar la cuenta ---------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.set_courier_status(%L, 'inactivo', 'ya no trabaja con nosotros')$$, (select id from tc where k = 'a')),
  'el admin desactiva la ficha');
reset role;
select ok((select not available and available_since is null from identity.couriers where id = (select id from tc where k = 'a')),
  'desactivar la ficha la deja no disponible');
select is((select count(*) from auth.sessions where user_id = (select id from tu where k = 'ana')), 0::bigint,
  'desactivar la ficha cierra sus sesiones');
select tests.authenticate_as((select id from tu where k = 'ana'), 'aal1');
select is(private.is_courier_session(), false, 'con la ficha inactiva ya no es sesión de repartidor');
reset role;

select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.revoke_courier_account(%L, 'motivo suficiente')$$, (select id from tc where k = 'a')),
  '42501', null::text, 'el coordinador no revoca cuentas');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.revoke_courier_account(%L, 'perdió el teléfono')$$, (select id from tc where k = 'a')),
  'el admin revoca la cuenta');
reset role;
select ok(exists (select 1 from identity.couriers where id = (select id from tc where k = 'a') and user_id is null)
          and exists (select 1 from identity.user_roles where user_id = (select id from tu where k = 'ana') and role = 'repartidor' and status = 'revocado'),
  'la revocación suelta la ficha y revoca el rol');

-- Permisos ----------------------------------------------------------------------------------------------------------------
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('create_courier_invitation', 'revoke_courier_account', 'courier_set_available')
    and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no ejecuta las funciones del repartidor');

select * from finish();
rollback;
