begin;
select plan(12);

-- Registros de prueba: uno vencido y uno reciente en cada tabla. Se insertan como dueño (la tabla es de solo inserción).
insert into audit.events (occurred_at, action, target_type) values
  (now() - interval '31 days', 'test.old', 'retencion'),
  (now() - interval '29 days', 'test.recent', 'retencion');
insert into audit.login_events (occurred_at, result) values
  (now() - interval '45 days', 'exitoso'),
  (now() - interval '2 days', 'exitoso');
select set_config('t.recent_login', (select id::text from audit.login_events where occurred_at > now() - interval '3 days' order by id desc limit 1), true);

-- La protección sigue igual fuera del mantenimiento -----------------------------------------------------------------------
select throws_ok($$delete from audit.events where action = 'test.old'$$, '42501', null::text, 'un DELETE común sigue bloqueado, aunque sea de un registro viejo');
select throws_ok($$update audit.events set action = 'x' where action = 'test.old'$$, '42501', null::text, 'UPDATE sigue bloqueado');
select set_config('audit.retention_purge', 'on', true);
select throws_ok($$delete from audit.events where action = 'test.recent'$$, '42501', null::text, 'ni con la marca de mantenimiento se borra algo de menos de 30 días');
select throws_ok($$update audit.events set action = 'x' where action = 'test.old'$$, '42501', null::text, 'la marca no habilita UPDATE');
select throws_ok($$delete from audit.it_incidents$$, '42501', null::text, 'los incidentes no tienen retención: nunca se borran');
select set_config('audit.retention_purge', 'off', true);

-- La tarea diaria borra solo lo vencido ------------------------------------------------------------------------------------
select ok((private.purge_audit_logs() ->> 'events')::int >= 1, 'la tarea informa cuántos registros de auditoría borró');
select is((select count(*) from audit.events where action = 'test.old'), 0::bigint, 'borra la auditoría de más de 30 días');
select is((select count(*) from audit.events where action = 'test.recent'), 1::bigint, 'conserva la auditoría de los últimos 30 días');
select is((select count(*) from audit.login_events where occurred_at < now() - interval '30 days'), 0::bigint, 'borra los accesos de más de 30 días');
select is((select count(*) from audit.login_events where id = current_setting('t.recent_login')::bigint), 1::bigint, 'conserva los accesos recientes');
select ok(exists (select 1 from audit.events where action = 'audit.retention_purged'), 'deja constancia de la limpieza en la auditoría');

-- Nadie fuera del mantenimiento la ejecuta ---------------------------------------------------------------------------------
create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm-ret@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select private.purge_audit_logs()$$, '42501', null::text, 'un administrador no puede lanzar la limpieza');
reset role;

select * from finish();
rollback;
