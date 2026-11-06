begin;
select plan(13);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli1', tests.create_user('wa1@t.test');
insert into tu select 'cli2', tests.create_user('wa2@t.test');

delete from private.whatsapp_outbox;

-- Una solicitud con teléfono encola el agradecimiento.
select tests.authenticate_as((select id from tu where k = 'cli1'), 'aal1');
select lives_ok($$select set_config('t.req1', public.submit_commerce_request('Café Norte',
  '{"contact_name":"Ana Pérez","phone":" 8888-1234 ","console_email":"cafe@t.test"}')::text, true)$$, 'la solicitud se envía');
reset role;

select is((select count(*)::int from private.whatsapp_outbox), 1, 'la solicitud encola un WhatsApp');
select is((select template from private.whatsapp_outbox), 'commerce_request_received', 'con la plantilla de afiliación');
select is((select to_phone from private.whatsapp_outbox), '8888-1234', 'al teléfono del formulario, sin espacios sobrantes');
select is((select data ->> 'business_name' from private.whatsapp_outbox), 'Café Norte', 'con el nombre del negocio');
select is((select status from private.whatsapp_outbox), 'pendiente', 'queda pendiente');

-- Sin teléfono no se encola nada y la solicitud no se bloquea.
select tests.authenticate_as((select id from tu where k = 'cli2'), 'aal1');
select lives_ok($$select public.submit_commerce_request('Sin Teléfono', '{"console_email":"sintel@t.test"}')$$, 'sin teléfono la solicitud igual se guarda');
reset role;
select is((select count(*)::int from private.whatsapp_outbox), 1, 'sin teléfono no se encola');

-- Reclamar, reintentar y marcar.
select is((select count(*)::int from public.claim_whatsapp_outbox(10)), 1, 'el envío reclama el mensaje');
select is((select status || ':' || attempts from private.whatsapp_outbox), 'enviando:1', 'queda en envío con un intento');
select public.mark_whatsapp_outbox((select id from private.whatsapp_outbox), false, 'UltraMsg respondió 500');
select is((select status from private.whatsapp_outbox), 'fallido', 'un fallo lo deja para reintentar');
select public.mark_whatsapp_outbox((select id from private.whatsapp_outbox), false, 'teléfono no válido', true);
select is((select status || ':' || last_error from private.whatsapp_outbox), 'omitido:teléfono no válido', 'un número inválido se omite con su motivo');

-- Solo el servicio puede usar la bandeja.
select throws_ok($$set local role authenticated; select public.claim_whatsapp_outbox(1)$$, '42501', null::text,
  'un usuario autenticado no puede reclamar mensajes');

select * from finish();
rollback;
