-- Liquidaciones a los comercios, reversiones por devolución y conciliación mensual (Política 9; migración 20261101000091).
begin;
select plan(19);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '670@t.test') from unnest(array['adm', 'com', 'cli', 'coo']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio 670');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda 670')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.s')::uuid, 'managua');
select set_config('t.p', public.create_product(current_setting('t.s')::uuid, 'Café 670')::text, true);
select set_config('t.v', public.create_variant(current_setting('t.p')::uuid, '500 g', 'CAFE-670', 200)::text, true);
select public.set_product_status(current_setting('t.p')::uuid, 'publicado');
reset role;

-- Tres pedidos de 200 en efectivo, entregados y cobrados.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o' || n, public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true) from generate_series(1, 3) n;
reset role;
set session_replication_role = replica;
update sales.orders set status = 'entregado', payment_status = 'pagado', delivered_at = now() - interval '2 days'
 where id in (current_setting('t.o1')::uuid, current_setting('t.o2')::uuid, current_setting('t.o3')::uuid);
set session_replication_role = origin;

-- Convenio: comisión del 10 %, cada 7 días, las devoluciones las asume el comercio.
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.set_commerce_agreement(%L, 10, 30, 'comercio')$$, (select id from tc where k = 'a')), '22023', null::text,
  'el periodo de liquidación no puede pasar de 15 días');
select lives_ok(format($$select public.set_commerce_agreement(%L, 10, 7, 'comercio')$$, (select id from tc where k = 'a')), 'la administración fija el convenio');
select is((select pending_orders || ':' || pending_amount from public.settlements_overview() where commerce_name = 'Comercio 670'), '3:540.00',
  'tres pedidos por liquidar: 600 menos 10 % de comisión');
select ok((select due_at between now() + interval '4 days 23 hours' and now() + interval '5 days 1 hour' from public.settlements_overview() where commerce_name = 'Comercio 670'),
  'la liquidación toca a los 7 días del pedido más antiguo');
select is((public.record_settlement((select id from tc where k = 'a'), 'Transferencia 001') ->> 'net')::numeric, 540.00, 'se liquidan 540');
select throws_ok(format($$select public.record_settlement(%L)$$, (select id from tc where k = 'a')), '22023', null::text,
  'sin pedidos nuevos no hay otra liquidación');
select is((public.order_settlement(current_setting('t.o1')::uuid) ->> 'net_to_commerce')::numeric, 180.00, 'el neto del pedido para el comercio es 180');
reset role;
select throws_ok($$update sales.settlements set net = 0$$, '42501', null::text, 'una liquidación registrada no se modifica');

-- Norma 9.2: la devolución aprobada de un pedido ya liquidado genera la reversión, que se descuenta en la siguiente.
insert into sales.return_requests (order_id, client_id, reason, photos)
values (current_setting('t.o2')::uuid, (select id from tu where k = 'cli'), 'Llegó dañado', array['x/1.jpg']);
update sales.return_requests set status = 'aprobada', decided_at = now(), decision_note = 'Aprobada en prueba' where order_id = current_setting('t.o2')::uuid;
select is((select amount from sales.settlement_reversals where order_id = current_setting('t.o2')::uuid), 180.00, 'nace una reversión por lo liquidado');
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o4', public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":2}]', current_setting('t.v'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
set session_replication_role = replica;
update sales.orders set status = 'entregado', payment_status = 'pagado', delivered_at = now() where id = current_setting('t.o4')::uuid;
set session_replication_role = origin;
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select pending_reversals from public.settlements_overview() where commerce_name = 'Comercio 670'), 180.00, 'la reversión queda pendiente');
select is((public.record_settlement((select id from tc where k = 'a')) ->> 'net')::numeric, 180.00, 'la siguiente liquidación descuenta la reversión: 360 menos 180');
select is((public.order_settlement(current_setting('t.o2')::uuid) ->> 'net_to_commerce')::numeric, 0.00, 'el neto del pedido devuelto queda en cero');
reset role;

-- Si el convenio dice que el costo es de Rapitrip, la reversión queda en cero (con constancia).
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.set_commerce_agreement((select id from tc where k = 'a'), 10, 7, 'rapitrip');
reset role;
insert into sales.return_requests (order_id, client_id, reason, photos)
values (current_setting('t.o3')::uuid, (select id from tu where k = 'cli'), 'No era lo que pedí', array['x/2.jpg']);
update sales.return_requests set status = 'aprobada', decided_at = now(), decision_note = 'Aprobada en prueba' where order_id = current_setting('t.o3')::uuid;
select is((select amount || ':' || bearer from sales.settlement_reversals where order_id = current_setting('t.o3')::uuid), '0.00:rapitrip',
  'con el costo a cargo de Rapitrip, la reversión es cero');

-- El comercio ve sus liquidaciones; coordinación no las ve.
select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*)::int from public.settlements_history()), 2, 'el comercio ve sus dos liquidaciones');
select is((public.my_settlement_status() ->> 'commission_pct')::numeric, 10.00, 'y su convenio');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok($$select * from public.settlements_overview()$$, '42501', null::text, 'coordinación no ve las liquidaciones');
reset role;

-- Control 9.1.1: conciliación mensual.
select tests.authenticate_as((select id from tu where k = 'adm'));
select ok((public.reconciliation_summary(current_date) ->> 'net_paid')::numeric >= 720, 'el resumen del mes suma lo liquidado');
select throws_ok($$select public.record_reconciliation((current_date + interval '2 months')::date, 'ninguna')$$, '22023', null::text, 'no se concilia un mes que no empezó');
select ok(public.record_reconciliation(current_date, 'Ninguna diferencia', null) is not null, 'la administración registra la conciliación');
reset role;

select * from finish();
rollback;
