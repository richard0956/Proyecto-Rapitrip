begin;
select plan(16);

delete from private.email_outbox;  -- la prueba cuenta correos de alerta: debe partir de una cola vacía

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'sup', tests.create_user('sup@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'sup'), 'superadmin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');

-- Sincronización desde el registro de Auth
insert into auth.audit_log_entries (instance_id, id, payload, created_at, ip_address)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(),
  jsonb_build_object('action', 'login', 'actor_id', (select id from tu where k = 'cli'),
                     'traits', jsonb_build_object('provider', 'email'))::json,
  now(), '127.0.0.1');
select private.sync_login_events();
select is((select count(*) from audit.login_events where user_id = (select id from tu where k = 'cli') and result = 'exitoso'),
  1::bigint, 'el inicio de sesión de Auth se copia a login_events');
select private.sync_login_events();
select is((select count(*) from audit.login_events where user_id = (select id from tu where k = 'cli')),
  1::bigint, 'sincronizar de nuevo no duplica');

-- Incidente automático por intentos fallidos
insert into audit.login_events (user_id, occurred_at, result)
select (select id from tu where k = 'caj'), now(), 'fallido' from generate_series(1, 9);
select is(private.evaluate_failed_logins(), 0, '9 fallos en una hora no abren incidente');
insert into audit.login_events (user_id, occurred_at, result) values ((select id from tu where k = 'caj'), now(), 'fallido');
select is(private.evaluate_failed_logins(), 1, 'el décimo fallo abre un incidente');
select ok(exists (select 1 from audit.it_incidents where origin = 'automatico' and type = 'seguridad' and severity = 'alta'
  and (metadata ->> 'user_id')::uuid = (select id from tu where k = 'caj')),
  'el incidente es de seguridad, automático y de gravedad alta');
select is((select count(*) from private.email_outbox where template = 'incident_alert'), 2::bigint,
  'se avisa por correo al admin y al superadmin');
select is(private.evaluate_failed_logins(), 0, 'no se repite el incidente dentro de la misma hora');

insert into audit.login_events (user_id, occurred_at, result)
select (select id from tu where k = 'cli'), now(), 'fallido' from generate_series(1, 12);
select is(private.evaluate_failed_logins(), 0, 'las cuentas solo de cliente no abren incidentes');

-- Reportar y gestionar incidentes
select tests.authenticate_as((select id from tu where k = 'coo'));
select lives_ok($$select set_config('t.inc', public.report_incident('interrupcion', 'media', 'La consola no carga')::text, true)$$,
  'el coordinador reporta un incidente');
select throws_ok(format($$select public.set_incident_status(%L, 'resuelto', 'ya funciona')$$, current_setting('t.inc')),
  '42501', null::text, 'el coordinador no cierra incidentes');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok($$select public.report_incident('seguridad', 'baja', 'Algo raro en mi cuenta')$$, '42501', null::text,
  'un cliente no usa el registro de incidentes');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.set_incident_status(%L, 'en_atencion')$$, current_setting('t.inc')),
  'el admin toma el incidente');
select throws_ok(format($$select public.set_incident_status(%L, 'resuelto')$$, current_setting('t.inc')),
  '22023', null::text, 'cerrar exige una resolución');
select lives_ok(format($$select public.set_incident_status(%L, 'resuelto', 'Se reinició el servicio de la consola')$$, current_setting('t.inc')),
  'el admin cierra el incidente con resolución');
select throws_ok(format($$select public.set_incident_status(%L, 'abierto')$$, current_setting('t.inc')),
  '22023', null::text, 'un incidente resuelto no se reabre');
reset role;

select throws_ok($$delete from audit.it_incidents$$, '42501', null::text, 'los incidentes nunca se borran');

select * from finish();
rollback;