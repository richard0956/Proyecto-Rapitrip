begin;
select plan(20);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'sup', tests.create_user('sup@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'sup'), 'superadmin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', tests.create_commerce('C1'));

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select gen_random_uuid(), id, 'totp', 'verified', now(), now() from tu where k in ('caj', 'com');
insert into auth.sessions (id, user_id, created_at, updated_at)
select gen_random_uuid(), id, now(), now() from tu where k = 'caj';
insert into identity.couriers (full_name, phone, vehicle_type, document_path)
values ('Rep Uno', '88888888', 'moto', 'docs/secreto.pdf');

-- Restablecer MFA
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.reset_mfa(%L, 'perdió el teléfono, verificado por llamada')$$, (select id from tu where k = 'caj')),
  'el admin restablece el segundo factor de un cajero');
select lives_ok(format($$select public.reset_mfa(%L, 'cambio de teléfono del comercio')$$, (select id from tu where k = 'com')),
  'el admin restablece el segundo factor de un comercio');
select throws_ok(format($$select public.reset_mfa(%L, 'intento sobre el superadmin')$$, (select id from tu where k = 'sup')),
  '42501', null::text, 'el segundo factor del superadmin solo se restablece por código');
select throws_ok(format($$select public.reset_mfa(%L, 'intento sobre mi propia cuenta')$$, (select id from tu where k = 'adm')),
  '42501', null::text, 'nadie restablece su propio segundo factor');
select throws_ok(format($$select public.reset_mfa(%L, 'corto')$$, (select id from tu where k = 'caj')),
  '22023', null::text, 'el motivo exige al menos 10 caracteres');
reset role;
select is((select count(*) from auth.mfa_factors where user_id = (select id from tu where k = 'caj')), 0::bigint, 'se borran los factores');
select is((select count(*) from auth.sessions where user_id = (select id from tu where k = 'caj')), 0::bigint, 'se cierran las sesiones');
select ok(exists (select 1 from audit.events where action = 'mfa.reset' and target_id = (select id::text from tu where k = 'caj')
  and reason like 'perdió%'), 'el restablecimiento queda auditado con su motivo');

select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.reset_mfa(%L, 'intento de un cajero')$$, (select id from tu where k = 'com')),
  '42501', null::text, 'el cajero no restablece factores');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'), 'aal2',
  jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', extract(epoch from now())::bigint - 3600),
                    jsonb_build_object('method', 'password', 'timestamp', extract(epoch from now())::bigint - 3700)));
select throws_ok(format($$select public.reset_mfa(%L, 'con segundo factor viejo')$$, (select id from tu where k = 'com')),
  '42501', null::text, 'exige MFA de los últimos 5 minutos');
select throws_ok($$select public.export_dataset('accounts', 'auditoría anual de cuentas')$$,
  '42501', null::text, 'exportar exige MFA de los últimos 5 minutos');
reset role;

-- Exportar
select tests.authenticate_as((select id from tu where k = 'adm'));
select ok((public.export_dataset('accounts', 'auditoría anual de cuentas') ->> 'count')::int >= 4,
  'exporta las cuentas con rol operativo');
select ok(not ((public.export_dataset('accounts', 'auditoría anual de cuentas') -> 'rows')
  @> jsonb_build_array(jsonb_build_object('user_id', (select id from tu where k = 'cli')))),
  'las cuentas solo de cliente no se exportan');
select ok(not ((public.export_dataset('couriers', 'revisión de repartidores activos') -> 'rows')::text like '%secreto%'),
  'el documento del repartidor nunca se exporta');
select throws_ok($$select public.export_dataset('clientes', 'auditoría anual de cuentas')$$, '22023', null::text,
  'solo se exportan conjuntos conocidos');
select throws_ok($$select public.export_dataset('accounts', 'corto')$$, '22023', null::text, 'el motivo es obligatorio');
reset role;
select ok(exists (select 1 from audit.events where action = 'export' and target_id = 'accounts'
  and (metadata ->> 'count')::int >= 4), 'la exportación queda auditada con la cantidad de registros');

select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok($$select public.export_dataset('accounts', 'intento de un cajero sin permiso')$$, '42501', null::text,
  'el cajero no exporta');
reset role;

-- Acciones de scripts
select set_config('role', 'service_role', true);
select lives_ok(format($$select public.audit_script_action('script.mfa_reset', %L, 'restablecimiento del superadmin por el equipo técnico')$$,
  (select id from tu where k = 'sup')), 'un script registra su acción en la auditoría');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.audit_script_action('script.mfa_reset', %L, 'intento de falsificar auditoría')$$,
  (select id from tu where k = 'sup')), '42501', null::text, 'authenticated no puede escribir acciones de script');
reset role;

select * from finish();
rollback;