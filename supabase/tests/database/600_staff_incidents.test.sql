begin;
select plan(14);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'c1', tests.create_commerce('Comercio Uno');
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test', 'Ana Caja');
insert into tu select 'coo', tests.create_user('coo@t.test', 'Luis Coordina');
insert into tu select 'com', tests.create_user('com@t.test', 'Marta Comercio');
insert into tu select 'cli', tests.create_user('cli@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'c1'));

-- Cada rol de la consola reporta ------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'caj'));
select ok(public.staff_report_incident('interrupcion', 'media', 'La impresora de tickets no responde', 'Caja y venta') is not null, 'caja reporta un incidente');
select throws_ok($$select public.staff_report_incident('interrupcion', 'baja', 'corto')$$, '22023', null::text, 'la descripción necesita al menos 10 caracteres');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select ok(public.staff_report_incident('seguridad', 'alta', 'Un repartidor recibió un enlace sospechoso', 'Pedidos', now() - interval '1 hour', 'Credenciales de la cuenta', 'Un repartidor') is not null, 'coordinación reporta un incidente');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select ok(public.staff_report_incident('interrupcion', 'baja', 'Las fotos del catálogo no cargan', 'Catálogo') is not null, 'el comercio reporta un incidente');
reset role;

select is((select metadata ->> 'source' from audit.it_incidents where reported_by = (select id from tu where k = 'caj')), 'caja', 'se marca que vino de caja');
select is((select metadata ->> 'source' from audit.it_incidents where reported_by = (select id from tu where k = 'coo')), 'coordinacion', 'se marca que vino de coordinación');
select is((select metadata ->> 'source' from audit.it_incidents where reported_by = (select id from tu where k = 'com')), 'comercio', 'se marca que vino del comercio');
select ok(exists (select 1 from audit.events where action = 'incident.created' and (after_data ->> 'source') = 'comercio'), 'el reporte queda auditado');

-- La administración ve origen, pantalla y quién reportó --------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select source || ' · ' || reported_from || ' · ' || reporter_name from public.it_incidents_list where source = 'caja'),
  'caja · Caja y venta · Ana Caja', 'la lista de incidentes muestra el origen, la pantalla y el nombre');
reset role;

-- Cada uno ve solo lo suyo -------------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*) from public.my_incidents()), 1::bigint, 'el comercio ve solo su reporte');
reset role;
select is(tests.count_as((select id from tu where k = 'caj'), 'public.it_incidents_list'), 0::bigint, 'caja no lee la lista completa de incidentes');
select tests.authenticate_as((select id from tu where k = 'caj'), 'aal1');
select is((select count(*) from public.my_incidents()), 0::bigint, 'sin sesión fuerte no se ven los reportes');
reset role;

-- Solo los roles de consola --------------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok($$select public.staff_report_incident('seguridad', 'alta', 'Esto no debería entrar')$$, '42501', null::text, 'un cliente no reporta por aquí');
reset role;

-- Tope diario --------------------------------------------------------------------------------------------------------------
select tests.authenticate_as((select id from tu where k = 'caj'));
select public.staff_report_incident('interrupcion', 'baja', 'Reporte de prueba número ' || n) from generate_series(2, 10) n;
select throws_ok($$select public.staff_report_incident('interrupcion', 'baja', 'El reporte once del día')$$, '22023', null::text, 'el reporte once del día se rechaza');
reset role;

select * from finish();
rollback;
