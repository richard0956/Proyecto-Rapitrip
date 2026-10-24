begin;
select plan(65);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'ra', tests.create_user('ra@t.test', 'Rep A');
insert into tu select 'rb', tests.create_user('rb@t.test', 'Rep B');
insert into tu select 'c1', tests.create_user('c1@t.test', 'Cliente Uno');
insert into tu select 'c2', tests.create_user('c2@t.test', 'Cliente Dos');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role(id, 'repartidor') from tu where k in ('ra', 'rb');

reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.s')::uuid, 'managua');
select set_config('t.pc', public.create_product(current_setting('t.s')::uuid, 'Café')::text, true);
select set_config('t.vc', public.create_variant(current_setting('t.pc')::uuid, '500 g', 'CAFE-500', 150)::text, true);
select public.set_product_status(current_setting('t.pc')::uuid, 'publicado');
select public.set_product_delivery(current_setting('t.pc')::uuid, true, 1, 10, 10, 10);
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.ca', public.create_courier('Rep A', '88880001', 'moto')::text, true);
select set_config('t.cb', public.create_courier('Rep B', '88880002', 'moto')::text, true);
select set_config('t.cc', public.create_courier('Rep C sin cuenta', '88880003', 'moto')::text, true);
reset role;
update identity.couriers set user_id = (select id from tu where k = 'ra') where id = current_setting('t.ca')::uuid;
update identity.couriers set user_id = (select id from tu where k = 'rb') where id = current_setting('t.cb')::uuid;
select set_config('t.cart', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vc')), true);

-- Pedidos: c1 hace o1..o3 y c2 hace o4..o6.
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.k' || n, public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true) from generate_series(1, 3) n;
reset role;
select tests.authenticate_as((select id from tu where k = 'c2'));
select set_config('t.k' || n, public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Colonia Nueva', '88882222', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true) from generate_series(4, 6) n;
reset role;
select set_config('t.o' || n, (select id::text from sales.orders where checkout_id = current_setting('t.k' || n)::uuid), true) from generate_series(1, 6) n;
update sales.orders set payment_method = 'tarjeta', payment_status = 'pagado' where id = current_setting('t.o3')::uuid;

-- o1, o3, o6: de A hasta listo. o2: de A, confirmado. o4: de A, listo. o5: del repartidor sin cuenta, listo.
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(o::uuid, 'confirmado') from unnest(array[current_setting('t.o1'), current_setting('t.o2'), current_setting('t.o3'), current_setting('t.o4'), current_setting('t.o5'), current_setting('t.o6')]) o;
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(o::uuid, current_setting('t.ca')::uuid) from unnest(array[current_setting('t.o1'), current_setting('t.o2'), current_setting('t.o3'), current_setting('t.o4'), current_setting('t.o6')]) o;
select public.assign_order_courier(current_setting('t.o5')::uuid, current_setting('t.cc')::uuid);
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(o::uuid, 'preparando') from unnest(array[current_setting('t.o1'), current_setting('t.o3'), current_setting('t.o4'), current_setting('t.o5'), current_setting('t.o6')]) o;
select public.set_order_status(o::uuid, 'listo') from unnest(array[current_setting('t.o1'), current_setting('t.o3'), current_setting('t.o4'), current_setting('t.o5'), current_setting('t.o6')]) o;
reset role;

-- Ayudante: sube la foto (como el repartidor A) y registra la evidencia.
create function pg_temp.ev(p_order text, p_kind text, p_sha text) returns uuid language plpgsql as $$
declare v_path text := current_setting('t.ca') || '/' || p_order || '/' || p_kind || '.jpg';
begin
  insert into storage.objects (bucket_id, name) values ('entregas', v_path);
  return public.courier_add_evidence(p_order::uuid, p_kind, v_path, repeat(p_sha, 64), 12.136500, -86.251500);
end $$;
grant execute on function pg_temp.ev(text, text, text) to public;
create function pg_temp.ev_home(p_order text, p_kind text, p_sha text) returns uuid language plpgsql as $$
declare v_path text := current_setting('t.ca') || '/' || p_order || '/' || p_kind || '.jpg';
begin
  insert into storage.objects (bucket_id, name) values ('entregas', v_path);
  return public.courier_add_evidence(p_order::uuid, p_kind, v_path, repeat(p_sha, 64), 12.140000, -86.250000);
end $$;
grant execute on function pg_temp.ev_home(text, text, text) to public;

select set_config('t.pick1', (select pickup_code from sales.order_codes where order_id = current_setting('t.o1')::uuid), true);
select set_config('t.del1', (select delivery_code from sales.order_codes where order_id = current_setting('t.o1')::uuid), true);
select set_config('t.tot1', (select total::text from sales.orders where id = current_setting('t.o1')::uuid), true);

-- ===== Recoger =====
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is(public.courier_pick_up(current_setting('t.o1')::uuid, current_setting('t.pick1')), 'falta_foto', 'sin la foto de recogida no se recoge, ni con el código correcto');
select lives_ok(format($$select pg_temp.ev(%L, 'recogida', 'a')$$, current_setting('t.o1')), 'A sube la foto de recogida');
select is(public.courier_pick_up(current_setting('t.o1')::uuid, '----'), 'incorrecto', 'un código incorrecto no deja recoger');
select is(public.courier_pick_up(current_setting('t.o1')::uuid, null), 'incorrecto', 'ni uno vacío');
reset role;
select is((select pickup_attempts from sales.order_codes where order_id = current_setting('t.o1')::uuid), 2, 'los intentos quedan contados aunque fallen');
select is((select status from sales.orders where id = current_setting('t.o1')::uuid), 'listo', 'y el pedido sigue listo');
select tests.authenticate_as((select id from tu where k = 'rb'), 'aal1');
select throws_ok(format($$select public.courier_pick_up(%L, %L)$$, current_setting('t.o1'), current_setting('t.pick1')), 'P0002', null::text, 'B no recoge el pedido de A');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select throws_ok(format($$select public.courier_pick_up(%L, '1234')$$, current_setting('t.o2')), '22023', null::text, 'un pedido que aún no está listo no se recoge');
select is(public.courier_pick_up(current_setting('t.o1')::uuid, current_setting('t.pick1')), 'ok', 'con foto y código correcto, A recoge');
select is(public.courier_pick_up(current_setting('t.o1')::uuid, current_setting('t.pick1')), 'ok', 'repetirlo es seguro');
reset role;
select is((select status from sales.orders where id = current_setting('t.o1')::uuid), 'en_camino', 'el pedido va en camino');
select is((select count(*) from sales.order_events where order_id = current_setting('t.o1')::uuid and to_status = 'en_camino'), 1::bigint, 'con un solo evento en la línea de tiempo');
select is((select actor_id from sales.order_events where order_id = current_setting('t.o1')::uuid and to_status = 'en_camino'), (select id from tu where k = 'ra'), 'cuyo actor es el repartidor');
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.courier_pick_up(%L, '1234')$$, current_setting('t.o4')), '42501', null::text, 'la coordinación no usa las acciones del repartidor');
reset role;

-- ===== Entregar en efectivo =====
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is(public.courier_deliver(current_setting('t.o1')::uuid, current_setting('t.del1'), current_setting('t.tot1')::numeric), 'falta_foto', 'sin la foto de entrega no se entrega');
select lives_ok(format($$select pg_temp.ev_home(%L, 'entrega', '1')$$, current_setting('t.o1')), 'A sube la foto de entrega en el domicilio');
select throws_ok(format($$select public.courier_deliver(%L, %L)$$, current_setting('t.o1'), current_setting('t.del1')), '22023', null::text, 'en efectivo hay que indicar el monto cobrado');
select throws_ok(format($$select public.courier_deliver(%L, %L, 1.00)$$, current_setting('t.o1'), current_setting('t.del1')), '22023', null::text, 'si el monto no coincide, hay que explicarlo');
select is(public.courier_deliver(current_setting('t.o1')::uuid, '----', current_setting('t.tot1')::numeric), 'incorrecto', 'un código de entrega incorrecto no deja entregar');
select is(public.courier_deliver(current_setting('t.o1')::uuid, current_setting('t.del1'), current_setting('t.tot1')::numeric, 'Juan, vecino'), 'ok', 'con foto, código y monto, A entrega');
reset role;
select is((select status from sales.orders where id = current_setting('t.o1')::uuid), 'entregado', 'el pedido queda entregado');
select is((select payment_status from sales.orders where id = current_setting('t.o1')::uuid), 'pagado', 'y pagado');
select ok((select payment_ref ~ '^CE-[0-9A-F]{6}$' and cash_collected::text = current_setting('t.tot1') from sales.orders where id = current_setting('t.o1')::uuid), 'queda el código CE y el monto cobrado');
select ok((select reason like '%Recibió: Juan, vecino%' from sales.order_events where order_id = current_setting('t.o1')::uuid and to_status = 'entregado'), 'la línea de tiempo dice quién recibió');
select set_config('t.ce1', (select payment_ref from sales.orders where id = current_setting('t.o1')::uuid), true);
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is(public.courier_deliver(current_setting('t.o1')::uuid, current_setting('t.del1'), current_setting('t.tot1')::numeric), 'ok', 'entregar de nuevo es seguro');
select is(public.courier_cash_code(current_setting('t.o1')::uuid), current_setting('t.ce1'), 'el repartidor ve su código CE para llevarlo al cajero');
reset role;
select is((select payment_ref from sales.orders where id = current_setting('t.o1')::uuid), current_setting('t.ce1'), 'y repetir no genera otro código');
select tests.authenticate_as((select id from tu where k = 'rb'), 'aal1');
select throws_ok(format($$select public.courier_cash_code(%L)$$, current_setting('t.o1')), 'P0002', null::text, 'B no ve el código CE de A');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.register_courier_cash(%L)$$, current_setting('t.o1')), '23505', null::text, 'la coordinación ya no puede registrar un efectivo que el repartidor registró');
reset role;

-- ===== Diferencia de efectivo y pedido pagado con tarjeta =====
select set_config('t.pick6', (select pickup_code from sales.order_codes where order_id = current_setting('t.o6')::uuid), true);
select set_config('t.del6', (select delivery_code from sales.order_codes where order_id = current_setting('t.o6')::uuid), true);
select set_config('t.tot6', (select total::text from sales.orders where id = current_setting('t.o6')::uuid), true);
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select pg_temp.ev(current_setting('t.o6'), 'recogida', 'b');
select (public.courier_pick_up(current_setting('t.o6')::uuid, current_setting('t.pick6')) = 'ok')::text;
select pg_temp.ev_home(current_setting('t.o6'), 'entrega', 'b');
select is(public.courier_deliver(current_setting('t.o6')::uuid, current_setting('t.del6'), (current_setting('t.tot6')::numeric - 20), null, 'El cliente solo tenía ese dinero'), 'ok', 'con una nota, se entrega aunque el monto cobrado sea distinto');
reset role;
select is((select cash_collected from sales.orders where id = current_setting('t.o6')::uuid), current_setting('t.tot6')::numeric - 20, 'queda el monto realmente cobrado');
select ok(exists (select 1 from audit.events where action = 'order.courier_cash_registered' and target_id = current_setting('t.o6') and (after_data ->> 'difference')::numeric = -20), 'y la diferencia queda auditada');

select set_config('t.pick3', (select pickup_code from sales.order_codes where order_id = current_setting('t.o3')::uuid), true);
select set_config('t.del3', (select delivery_code from sales.order_codes where order_id = current_setting('t.o3')::uuid), true);
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select pg_temp.ev(current_setting('t.o3'), 'recogida', 'c');
select (public.courier_pick_up(current_setting('t.o3')::uuid, current_setting('t.pick3')) = 'ok')::text;
select pg_temp.ev_home(current_setting('t.o3'), 'entrega', 'c');
select throws_ok(format($$select public.courier_deliver(%L, %L, 50)$$, current_setting('t.o3'), current_setting('t.del3')), '22023', null::text, 'un pedido pagado con tarjeta no cobra nada');
select is(public.courier_deliver(current_setting('t.o3')::uuid, current_setting('t.del3')), 'ok', 'y se entrega solo con foto y código');
reset role;
select is((select payment_ref from sales.orders where id = current_setting('t.o3')::uuid), null, 'sin código CE');
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select throws_ok(format($$select public.courier_cash_code(%L)$$, current_setting('t.o3')), 'P0002', null::text, 'y sin código de efectivo que mostrar');
reset role;

-- ===== Coordinación salta la evidencia: debe decir por qué =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.set_order_status(%L, 'en_camino')$$, current_setting('t.o4')), '22023', null::text, 'despachar por un repartidor con cuenta sin su evidencia exige un motivo');
select lives_ok(format($$select public.set_order_status(%L, 'en_camino', 'el repartidor no tiene señal')$$, current_setting('t.o4')), 'con motivo se despacha');
select lives_ok(format($$select public.set_order_status(%L, 'en_camino')$$, current_setting('t.o5')), 'por un repartidor sin cuenta se despacha como siempre');
reset role;
select ok(exists (select 1 from audit.events where action = 'order.evidence_skipped' and target_id = current_setting('t.o4') and reason = 'el repartidor no tiene señal'), 'el salto queda auditado con su motivo');
select is((select count(*) from audit.events where action = 'order.evidence_skipped' and target_id = current_setting('t.o5')), 0::bigint, 'sin cuenta no hay evidencia que saltar');
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select complete from public.order_evidence_status where order_id = current_setting('t.o4')::uuid), false, 'y el pedido figura con la cadena incompleta');
reset role;

-- ===== Avisos a coordinación =====
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select throws_ok(format($$select public.courier_report_problem(%L, 'no_entregado', 'Nadie abrió la puerta')$$, current_setting('t.o4')), '22023', null::text, 'para avisar que no se pudo entregar hay que subir la foto del intento');
select lives_ok(format($$select pg_temp.ev_home(%L, 'fallida', 'd')$$, current_setting('t.o4')), 'A sube la foto del intento fallido');
select lives_ok(format($$select set_config('t.i1', public.courier_report_problem(%L, 'no_entregado', 'Nadie abrió la puerta')::text, true)$$, current_setting('t.o4')), 'y avisa a coordinación');
select is(public.courier_report_problem(current_setting('t.o4')::uuid, 'no_entregado', 'Nadie abrió la puerta')::text, current_setting('t.i1'), 'avisar dos veces reutiliza el aviso abierto');
select throws_ok(format($$select public.courier_report_problem(%L, 'otro', 'Algo pasó con el pedido')$$, current_setting('t.o4')), '22023', null::text, 'el tipo de aviso debe ser válido');
select throws_ok(format($$select public.courier_report_problem(%L, 'problema', 'no')$$, current_setting('t.o4')), '22023', null::text, 'y el motivo suficiente');
select throws_ok(format($$select public.courier_report_problem(%L, 'no_cabe', 'No cabe en mi moto')$$, current_setting('t.o4')), '22023', null::text, '«no cabe» no se avisa con el pedido ya recogido');
select lives_ok(format($$select public.courier_report_problem(%L, 'no_cabe', 'No cabe en mi moto')$$, current_setting('t.o2')), '«no cabe» se avisa antes de recoger');
select is((select count(*) from public.courier_order_issues(current_setting('t.o4')::uuid)), 1::bigint, 'el repartidor ve los avisos de su pedido');
reset role;
select tests.authenticate_as((select id from tu where k = 'rb'), 'aal1');
select is((select count(*) from public.courier_order_issues(current_setting('t.o4')::uuid)), 0::bigint, 'B no ve los de A');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select count(*) from public.delivery_issues_list where status = 'abierta'), 2::bigint, 'la coordinación ve los avisos abiertos');
select throws_ok(format($$select public.resolve_delivery_issue(%L, 'x')$$, current_setting('t.i1')), '22023', null::text, 'atender un aviso exige decir qué se hizo');
select lives_ok(format($$select public.resolve_delivery_issue(%L, 'Se llamó al cliente y se reprograma')$$, current_setting('t.i1')), 'la coordinación lo atiende');
select throws_ok(format($$select public.resolve_delivery_issue(%L, 'Se llamó al cliente de nuevo')$$, current_setting('t.i1')), '22023', null::text, 'y no se atiende dos veces');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select is((select count(*) from public.delivery_issues_list), 0::bigint, 'un cliente no ve los avisos');
reset role;

-- ===== Devolver el pedido =====
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select throws_ok(format($$select public.courier_release_order(%L, 'no')$$, current_setting('t.o2')), '22023', null::text, 'devolver exige un motivo');
select throws_ok(format($$select public.courier_release_order(%L, 'Ya no puedo con este')$$, current_setting('t.o4')), '22023', null::text, 'no se devuelve un pedido ya recogido');
select lives_ok(format($$select public.courier_release_order(%L, 'Se me dañó la moto')$$, current_setting('t.o2')), 'A devuelve el pedido que no había recogido');
select throws_ok(format($$select public.courier_release_order(%L, 'Se me dañó la moto')$$, current_setting('t.o2')), 'P0002', null::text, 'y ya no es suyo');
reset role;
select is((select courier_id from sales.orders where id = current_setting('t.o2')::uuid), null, 'el pedido queda sin repartidor');
select is((select string_agg(kind || ':' || status, ',' order by kind) from sales.delivery_issues where order_id = current_setting('t.o2')::uuid), 'devuelto:abierta,no_cabe:atendida', 'coordinación recibe el aviso y el de «no cabe» se da por atendido');

-- ===== Permisos =====
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('courier_pick_up', 'courier_deliver', 'courier_cash_code', 'courier_report_problem', 'courier_release_order',
                      'courier_order_issues', 'resolve_delivery_issue')
    and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no ejecuta ninguna acción del repartidor');
select is(has_table_privilege('anon', 'sales.delivery_issues', 'select'), false, 'anon no lee los avisos');

select * from finish();
rollback;
