begin;
select plan(5);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');

-- Un evento que quedó por reembolsar y otro ya resuelto
insert into sales.payment_events (event_id, event_type, order_id, outcome) values
  ('evt_test_pendiente01', 'checkout.session.completed', null, 'reembolsar_tarde'),
  ('evt_test_resuelto001', 'checkout.session.completed', null, 'reembolsado_tarde'),
  ('evt_test_pagado00001', 'checkout.session.completed', null, 'pagado');

select is(tests.count_as((select id from tu where k = 'adm'), 'public.payment_events_list'), 1::bigint, 'la administración ve solo los pagos por reembolsar');
select is(tests.count_as((select id from tu where k = 'coo'), 'public.payment_events_list'), 0::bigint, 'coordinación no los ve');
select is(tests.count_as((select id from tu where k = 'cli'), 'public.payment_events_list'), 0::bigint, 'un cliente no los ve');
select is(tests.count_as((select id from tu where k = 'adm'), 'public.payment_events_list', 'aal1'), 0::bigint, 'sin segundo factor la administración tampoco los ve');
select is(tests.count_as_anon('public.payment_events_list'), -1::bigint, 'anon no tiene acceso a la vista');

select * from finish();
rollback;
