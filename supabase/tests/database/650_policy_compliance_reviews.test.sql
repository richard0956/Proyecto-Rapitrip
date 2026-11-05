-- Revisión trimestral de accesos, exportación con destinatario y aviso de 72 horas (migración 20261101000089).
begin;
select plan(15);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '650@t.test') from unnest(array['adm', 'caj']) k;
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');

-- Norma 1.1.6: revisión trimestral de accesos.
select tests.authenticate_as((select id from tu where k = 'adm'));
select ok((public.access_review_status() ->> 'overdue')::boolean or (public.access_review_status() ->> 'last_at') is not null,
  'el estado de la revisión responde');
select throws_ok($$select public.record_access_review('corto')$$, '22023', null::text, 'la revisión exige describir lo revisado');
select ok(public.record_access_review('Revisé cada cuenta del equipo y sus roles vigentes', 'Revoqué un cajero que ya no trabaja') is not null,
  'la administración registra la revisión');
select is((public.access_review_status() ->> 'overdue')::boolean, false, 'recién hecha, no vence');
select ok((public.access_review_status() ->> 'due_at')::timestamptz between now() + interval '89 days' and now() + interval '93 days',
  'la siguiente toca en tres meses');
select ok((select (snapshot -> 'admin' ->> 'activo')::int >= 1 from public.access_reviews() limit 1), 'guarda cuántas cuentas había por rol');
reset role;
select throws_ok($$update identity.access_reviews set findings = 'cambiado después de registrada'$$, '42501', null::text,
  'una revisión registrada no se modifica');
select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok($$select public.record_access_review('Revisé todo y no hay nada raro')$$, '42501', null::text, 'caja no registra revisiones');
reset role;

-- Control 1.1.1: la exportación pide destinatario, canal e identidad verificada.
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select public.export_dataset('couriers', 'revisión de repartidores activos')$$, '22023', null::text,
  'sin destinatario no se exporta');
select throws_ok($$select public.export_dataset('couriers', 'revisión de repartidores activos', p_recipient => 'Coordinación', p_channel => 'Correo cifrado')$$, '22023', null::text,
  'sin verificar la identidad del destinatario no se exporta');
select ok((public.export_dataset('couriers', 'revisión de repartidores activos', p_recipient => 'Coordinación', p_channel => 'Correo cifrado', p_identity_verified => true) ->> 'count') is not null,
  'con destinatario, canal e identidad verificada sí se exporta');
reset role;
select is((select metadata ->> 'recipient' || ' / ' || (metadata ->> 'channel') from audit.events where action = 'export' order by id desc limit 1),
  'Coordinación / Correo cifrado', 'la auditoría guarda el destinatario y el canal');

-- Norma 3.3.4: aviso a los afectados de un incidente de seguridad.
insert into audit.it_incidents (type, origin, severity, description, metadata)
values ('seguridad', 'manual', 'alta', 'Filtración de prueba 650', '{"data_involved":"correos","affected":"clientes"}');
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.record_incident_notice(%L, 'Correo', 'corto')$$, (select id from audit.it_incidents where description = 'Filtración de prueba 650')),
  '22023', null::text, 'el aviso exige describir qué se informó');
select lives_ok(format($$select public.record_incident_notice(%L, 'Correo a cada cliente', 'Les informamos qué datos se expusieron y qué hacer')$$, (select id from audit.it_incidents where description = 'Filtración de prueba 650')),
  'la administración registra el aviso');
select ok((select notified_at is not null and notice_channel = 'Correo a cada cliente' from public.it_incidents_list where description = 'Filtración de prueba 650'),
  'la lista muestra cuándo y por dónde se avisó');
reset role;

select * from finish();
rollback;
