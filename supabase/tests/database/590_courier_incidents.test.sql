begin;
select plan(13);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'ra', tests.create_user('ra@t.test', 'Rep A');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'ra'), 'repartidor');

select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.ca', public.create_courier('Rep A', '88880001', 'moto')::text, true);
reset role;
update identity.couriers set user_id = (select id from tu where k = 'ra') where id = current_setting('t.ca')::uuid;

-- Reportar desde la app -------------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select ok(public.courier_report_incident('interrupcion', 'media', 'La foto de entrega no se sube', 'Detalle del pedido', 'Mozilla/5.0 (Android)') is not null,
  'el repartidor reporta un incidente de TI');
select throws_ok($$select public.courier_report_incident('interrupcion', 'baja', 'corto')$$, '22023', null::text,
  'la descripción necesita al menos 10 caracteres');
select throws_ok($$select public.courier_report_incident('interrupcion', 'baja', null)$$, '22023', null::text,
  'la descripción es obligatoria');
reset role;

select is((select origin::text || '/' || status::text from audit.it_incidents where reported_by = (select id from tu where k = 'ra')),
  'manual/abierto', 'queda como incidente manual abierto');
select is((select metadata ->> 'source' from audit.it_incidents where reported_by = (select id from tu where k = 'ra')),
  'repartidor', 'se marca que vino del repartidor');
select is((select (metadata ->> 'courier_id')::uuid from audit.it_incidents where reported_by = (select id from tu where k = 'ra')),
  current_setting('t.ca')::uuid, 'guarda la ficha del repartidor');
select is((select metadata ->> 'where' from audit.it_incidents where reported_by = (select id from tu where k = 'ra')),
  'Detalle del pedido', 'guarda la pantalla donde pasó');
select ok(exists (select 1 from audit.events where action = 'incident.created' and (after_data ->> 'source') = 'repartidor'),
  'el reporte queda auditado');

-- Lo ve la administración en la consola ---------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select source || ' · ' || reported_from from public.it_incidents_list where source = 'repartidor'),
  'repartidor · Detalle del pedido', 'la lista de incidentes muestra el origen y la pantalla');
reset role;

-- Solo el repartidor por esta puerta -----------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
select throws_ok($$select public.courier_report_incident('seguridad', 'alta', 'Esto no debería entrar')$$, '42501', null::text,
  'un cliente no reporta incidentes');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok($$select public.courier_report_incident('seguridad', 'alta', 'Esto no debería entrar')$$, '42501', null::text,
  'la coordinación usa el reporte de la consola, no este');
reset role;

-- Tope diario -----------------------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select public.courier_report_incident('interrupcion', 'baja', 'Reporte de prueba número ' || n) from generate_series(2, 5) n;
reset role;
-- La tabla de incidentes no la lee el repartidor: se cuenta fuera de su sesión.
select is((select count(*) from audit.it_incidents where reported_by = (select id from tu where k = 'ra')), 5::bigint, 'acepta hasta 5 reportes al día');
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select throws_ok($$select public.courier_report_incident('interrupcion', 'baja', 'El sexto reporte del día')$$, '22023', null::text,
  'el sexto reporte del día se rechaza');
reset role;

select * from finish();
rollback;
