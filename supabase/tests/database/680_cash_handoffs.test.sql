-- Cajas físicas, entregas de efectivo del repartidor al cajero y responsabilidades (migración 20261101000092).
begin;
select plan(44);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '680@t.test', 'Persona ' || k) from unnest(array['adm', 'coo', 'com', 'cli', 'caj1', 'caj2', 'rep']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio 680');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'caj1'), 'cajero');
select tests.grant_role((select id from tu where k = 'caj2'), 'cajero');
select tests.grant_role((select id from tu where k = 'rep'), 'repartidor');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda 680')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.s')::uuid, 'managua');
select set_config('t.p', public.create_product(current_setting('t.s')::uuid, 'Café 680')::text, true);
select set_config('t.v', public.create_variant(current_setting('t.p')::uuid, '500 g', 'CAFE-680', 200)::text, true);
select public.set_product_status(current_setting('t.p')::uuid, 'publicado');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.cr', public.create_courier('Rep 680', '88886801', 'moto')::text, true);
select set_config('t.cx', public.create_courier('Rep 680 sin cuenta', '88886802', 'moto')::text, true);
reset role;
update identity.couriers set user_id = (select id from tu where k = 'rep') where id = current_setting('t.cr')::uuid;

-- Cinco pedidos en efectivo del cliente. o1..o3 los entrega el repartidor con cuenta; o4 queda por asignar; o5, el de sin cuenta.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o' || n, public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true) from generate_series(1, 5) n;
reset role;
set session_replication_role = replica;
update sales.orders set status = 'entregado', payment_status = 'pagado', delivered_at = now() - interval '10 minutes',
       courier_id = current_setting('t.cr')::uuid,
       payment_ref = case id when current_setting('t.o1')::uuid then 'CE-680001'
                            when current_setting('t.o2')::uuid then 'CE-680002' else 'CE-680003' end,
       cash_collected = total
 where id in (current_setting('t.o1')::uuid, current_setting('t.o2')::uuid, current_setting('t.o3')::uuid);
update sales.orders set status = 'entregado', payment_status = 'pagado', delivered_at = now(), courier_id = current_setting('t.cx')::uuid,
       payment_ref = 'CE-680X05', cash_collected = total
 where id = current_setting('t.o5')::uuid;
update sales.orders set status = 'confirmado' where id = current_setting('t.o4')::uuid;
set session_replication_role = origin;
select set_config('t.tot', (select total::text from sales.orders where id = current_setting('t.o1')::uuid), true);

-- Cajas físicas: las crea la administración; cada caja con su código y, si se quiere, su cajero.
select tests.authenticate_as((select id from tu where k = 'caj1'));
select throws_ok($$select public.create_cash_register('Caja X', 'X-680')$$, '42501', null::text, 'un cajero no crea cajas');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select public.create_cash_register('Caja X', 'x 6')$$, '22023', null::text, 'el código de la caja tiene formato fijo');
select throws_ok(format($$select public.create_cash_register('Caja X', 'X-680', %L)$$, (select id from tu where k = 'com')), '22023', null::text,
  'solo se asigna a quien tiene el rol de cajero');
select set_config('t.r1', public.create_cash_register('Caja 680 uno', 't680-1', (select id from tu where k = 'caj1'))::text, true);
select set_config('t.r2', public.create_cash_register('Caja 680 dos', 'T680-2')::text, true);
select is((select code from public.cash_registers_admin() where register_id = current_setting('t.r1')::uuid), 'T680-1', 'el código se guarda en mayúsculas');
select throws_ok($$select public.create_cash_register('Caja 680 uno', 'T680-3')$$, '23505', null::text, 'no hay dos cajas con el mismo nombre');
reset role;

-- Apertura: la caja asignada a otro cajero no se abre; sin elegir, se abre la propia.
select tests.authenticate_as((select id from tu where k = 'caj2'));
select throws_ok(format($$select public.open_cash_session(100, %L)$$, current_setting('t.r1')), '42501', null::text, 'otro cajero no abre una caja asignada');
select set_config('t.s2', public.open_cash_session(300, current_setting('t.r2')::uuid)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'caj1'));
select set_config('t.s1', public.open_cash_session(200)::text, true);
reset role;
select is((select register_id::text from sales.cash_sessions where id = current_setting('t.s1')::uuid), current_setting('t.r1'), 'sin elegir, el turno se abre en la caja asignada');
select tests.authenticate_as((select id from tu where k = 'caj1'));
select throws_ok(format($$select public.open_cash_session(100, %L)$$, current_setting('t.r2')), '23505', null::text, 'una caja tiene un solo turno abierto');
reset role;

-- El repartidor ve su efectivo y envía la entrega a una caja abierta.
select tests.authenticate_as((select id from tu where k = 'rep'));
select is((public.courier_cash_status() ->> 'custody_total')::numeric, 3 * current_setting('t.tot')::numeric, 'el repartidor tiene a su cargo el efectivo de tres pedidos');
select ok((select count(*) from public.open_cash_points() where session_id in (current_setting('t.s1')::uuid, current_setting('t.s2')::uuid)) = 2, 've las cajas abiertas');
select set_config('t.h1', public.courier_start_cash_handoff(current_setting('t.s1')::uuid, array[current_setting('t.o1')::uuid, current_setting('t.o2')::uuid])::text, true);
select throws_ok(format($$select public.courier_start_cash_handoff(%L)$$, current_setting('t.s2')), '23505', null::text, 'una sola entrega pendiente a la vez');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.start_cash_handoff_for(%L, %L)$$, current_setting('t.cr'), current_setting('t.s1')), '22023', null::text,
  'coordinación no envía por un repartidor que tiene cuenta');
reset role;

-- El cajero de esa caja la ve sin montos y cuenta a ciegas; otro cajero no puede confirmarla.
select tests.authenticate_as((select id from tu where k = 'caj1'));
select is((select orders_count from public.cashier_pending_handoffs() where handoff_id = current_setting('t.h1')::uuid), 2, 'el cajero ve la entrega con sus dos pedidos');
select throws_ok('select public.close_cash_session(0)', '22023', null::text, 'no se cierra con una entrega esperando');
reset role;
select tests.authenticate_as((select id from tu where k = 'caj2'));
select throws_ok(format($$select public.confirm_cash_handoff(%L, 1)$$, current_setting('t.h1')), '42501', null::text, 'otro cajero no confirma una entrega ajena');
reset role;
select tests.authenticate_as((select id from tu where k = 'caj1'));
select is(public.confirm_cash_handoff(current_setting('t.h1')::uuid, 2 * current_setting('t.tot')::numeric - 50, 'faltan 50') ->> 'difference', '-50.00',
  'el cajero cuenta 50 menos: la entrega queda con diferencia');
select throws_ok(format($$select public.confirm_cash_handoff(%L, 1)$$, current_setting('t.h1')), '23505', null::text, 'una entrega no se confirma dos veces');
reset role;
select is((select count(*)::int from sales.orders where cash_received_session = current_setting('t.s1')::uuid and cash_handoff_id = current_setting('t.h1')::uuid), 2,
  'los dos pedidos quedan recibidos en el turno de esa caja');
select is((select amount || ':' || responsible from sales.cash_accountability where handoff_id = current_setting('t.h1')::uuid), '50.00:repartidor',
  'el faltante de la entrega queda a cargo del repartidor');
select is((private.cash_breakdown(current_setting('t.s1')::uuid) ->> 'efectivo_web_recibido')::numeric, 2 * current_setting('t.tot')::numeric - 50,
  'la caja espera lo contado, no lo declarado');

-- Rechazo: el efectivo sigue con el repartidor y queda anotado.
select tests.authenticate_as((select id from tu where k = 'rep'));
select set_config('t.h2', public.courier_start_cash_handoff(current_setting('t.s2')::uuid)::text, true);
reset role;
select tests.authenticate_as((select id from tu where k = 'caj2'));
select throws_ok(format($$select public.reject_cash_handoff(%L, 'no')$$, current_setting('t.h2')), '22023', null::text, 'rechazar pide el motivo');
select lives_ok(format($$select public.reject_cash_handoff(%L, 'el repartidor no llegó a la caja')$$, current_setting('t.h2')), 'el cajero rechaza la entrega');
reset role;
select tests.authenticate_as((select id from tu where k = 'rep'));
select is(public.courier_cash_status() #>> '{last,status}', 'rechazada', 'el repartidor ve que la rechazaron');
select is((public.courier_cash_status() ->> 'custody_total')::numeric, current_setting('t.tot')::numeric, 'y el efectivo sigue a su cargo');
reset role;

-- Vencida: sin respuesta a tiempo, el efectivo sigue con el repartidor y queda anotado para los dos.
select tests.authenticate_as((select id from tu where k = 'rep'));
select set_config('t.h3', public.courier_start_cash_handoff(current_setting('t.s2')::uuid)::text, true);
reset role;
set session_replication_role = replica;
update sales.cash_handoffs set expires_at = now() - interval '1 minute' where id = current_setting('t.h3')::uuid;
set session_replication_role = origin;
select tests.authenticate_as((select id from tu where k = 'caj2'));
select is((select count(*)::int from public.cashier_pending_handoffs()), 0, 'la entrega vencida ya no espera al cajero');
select throws_ok(format($$select public.confirm_cash_handoff(%L, 1)$$, current_setting('t.h3')), '22023', null::text, 'una entrega vencida no se confirma');
reset role;
select is((select status from sales.cash_handoffs where id = current_setting('t.h3')::uuid), 'vencida', 'la entrega queda vencida');
select is((select string_agg(responsible, ',' order by responsible) from sales.cash_accountability where handoff_id = current_setting('t.h3')::uuid), 'cajero,repartidor',
  'el vencimiento queda anotado para el cajero y el repartidor');

-- Historial que no se modifica.
select throws_ok(format($$update sales.cash_handoffs set counted_amount = 0 where id = %L$$, current_setting('t.h1')), '42501', null::text, 'una entrega resuelta no se modifica');
select throws_ok(format($$delete from sales.cash_handoff_items where handoff_id = %L$$, current_setting('t.h1')), '42501', null::text, 'los pedidos de una entrega no se borran');

-- Límites: con más efectivo que el máximo, no recibe pedidos nuevos en efectivo.
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok('select public.set_cash_settings(2, 4, 5000)', '22023', null::text, 'el tiempo para confirmar va de 5 a 60 minutos');
select lives_ok('select public.set_cash_settings(15, 4, 100)', 'la administración ajusta los límites');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.o4'), current_setting('t.cr')), '22023', null::text,
  'con más efectivo encima que el máximo no se le asigna otro pedido en efectivo');
reset role;
select tests.authenticate_as((select id from tu where k = 'rep'));
select ok(public.courier_cash_status() ->> 'block' is not null, 'el repartidor ve por qué no recibe pedidos en efectivo');
reset role;

-- Efectivo retenido de más horas que las permitidas: se anota una sola vez por pedido.
set session_replication_role = replica;
update sales.orders set delivered_at = now() - interval '5 hours' where id = current_setting('t.o3')::uuid;
set session_replication_role = origin;
select tests.authenticate_as((select id from tu where k = 'rep'));
select public.courier_cash_status();
select public.courier_cash_status();
reset role;
select is((select count(*)::int from sales.cash_accountability where order_id = current_setting('t.o3')::uuid and kind = 'efectivo_retenido'), 1,
  'el efectivo retenido de más se anota una vez');

-- Coordinación entrega por el repartidor sin cuenta.
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.h5', public.start_cash_handoff_for(current_setting('t.cx')::uuid, current_setting('t.s1')::uuid)::text, true);
select ok((select count(*) from public.couriers_cash_overview() where courier_id in (current_setting('t.cr')::uuid, current_setting('t.cx')::uuid)) = 2,
  'coordinación ve el efectivo a cargo de cada repartidor');
reset role;
select tests.authenticate_as((select id from tu where k = 'caj1'));
select is(public.confirm_cash_handoff(current_setting('t.h5')::uuid, current_setting('t.tot')::numeric) ->> 'status', 'confirmada', 'la entrega exacta queda confirmada');

-- Arqueo: la diferencia queda a nombre del cajero de esa caja.
select is((public.close_cash_session(200 + 3 * current_setting('t.tot')::numeric - 50 - 20, 'faltan 20 en la gaveta') ->> 'difference')::numeric, -20::numeric,
  'el arqueo encuentra 20 de menos');
reset role;
select is((select kind || ':' || amount from sales.cash_accountability where session_id = current_setting('t.s1')::uuid and responsible = 'cajero'), 'faltante_arqueo:20.00',
  'el faltante del arqueo queda a cargo del cajero');
select tests.authenticate_as((select id from tu where k = 'caj1'));
select is((select count(*)::int from public.cash_handoffs_history(current_setting('t.s1')::uuid)), 2, 'el cajero ve las entregas de su turno');
reset role;

-- Medidas: coordinación ve, solo la administración decide, y una sola vez.
select set_config('t.a1', (select id::text from sales.cash_accountability where handoff_id = current_setting('t.h1')::uuid), true);
select tests.authenticate_as((select id from tu where k = 'coo'));
select ok((select count(*) from public.cash_accountability_list() where id = current_setting('t.a1')::uuid) = 1, 'coordinación ve las responsabilidades abiertas');
select throws_ok(format($$select public.decide_cash_accountability(%L, 'reposicion', 'repone los 50')$$, current_setting('t.a1')), '42501', null::text, 'coordinación no decide la medida');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.decide_cash_accountability(%L, 'reposicion', 'El repartidor repone los 50')$$, current_setting('t.a1')), 'la administración decide la medida');
select throws_ok(format($$select public.decide_cash_accountability(%L, 'sin_medida', 'otra decisión')$$, current_setting('t.a1')), '23505', null::text, 'la medida se decide una vez');
reset role;

select * from finish();
rollback;
