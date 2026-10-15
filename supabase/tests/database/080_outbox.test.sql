begin;
select plan(8);

-- Parte de una cola vacía aunque haya correos de pruebas manuales (se revierte al terminar).
delete from private.email_outbox;

select lives_ok($$select private.enqueue_email('a@t.test', 'commerce_approved', '{"business_name":"X"}')$$,
  'se encola un correo');
select throws_ok($$select private.enqueue_email('a@t.test', 'plantilla_que_no_existe')$$,
  '23514', null::text, 'solo plantillas conocidas');
select is((select count(*) from private.email_outbox where status = 'pendiente'), 1::bigint, 'queda un correo pendiente');

select set_config('role', 'service_role', true);
select is((select count(*) from public.claim_outbox(10)), 1::bigint, 'service_role reclama el correo');
reset role;
select is((select status || ':' || attempts from private.email_outbox), 'enviando:1', 'queda enviando con un intento');

select set_config('t.outbox', (select id::text from private.email_outbox), true);
select set_config('role', 'service_role', true);
select lives_ok(format($$select public.mark_outbox(%L, true)$$, current_setting('t.outbox')), 'se marca como enviado');
reset role;
select is((select status from private.email_outbox), 'enviado', 'estado final: enviado');

select tests.authenticate_as_anon();
select throws_ok($$select * from public.claim_outbox(10)$$, '42501', null::text, 'anon no reclama correos');
reset role;

select * from finish();
rollback;