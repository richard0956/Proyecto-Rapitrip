-- Reglas del Manual de Políticas de TI que exige la base de datos (migración 20261101000088).
begin;
select plan(14);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '640@t.test') from unnest(array['adm', 'com', 'coo', 'c1']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio 640');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

reset role;
insert into sales.programmed_bands (band, up_to_km, min_days, max_days, courier_pay, margin) values (1, 50, 1, 3, 100, 20) on conflict do nothing;
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda 640')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.s')::uuid, 'managua');
select set_config('t.pc', public.create_product(current_setting('t.s')::uuid, 'Café')::text, true);
select set_config('t.vc', public.create_variant(current_setting('t.pc')::uuid, '500 g', 'CAFE-640', 150)::text, true);
select set_config('t.ps', public.create_product(current_setting('t.s')::uuid, 'Sillón')::text, true);
select set_config('t.vs', public.create_variant(current_setting('t.ps')::uuid, 'Gris', 'SILLON-640', 8000)::text, true);
select public.set_product_status(p::uuid, 'publicado') from unnest(array[current_setting('t.pc'), current_setting('t.ps')]) p;
select public.set_product_delivery(current_setting('t.pc')::uuid, true, 1, 10, 10, 10);
select public.set_product_delivery(current_setting('t.ps')::uuid, false, 40, 90, 80, 85, 4);
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.moto', public.create_courier('Moto 640', '88886400', 'moto')::text, true);
reset role;

-- Norma 6.2.1: el comercio tiene 15 minutos para confirmar un express; el programado conserva sus 24 horas.
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.co', public.create_checkout(
  format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1},{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vc'), current_setting('t.vs'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400, 'managua')::jsonb ->> 'checkout_id', true);
reset role;
select set_config('t.e', (select id::text from sales.orders where checkout_id = current_setting('t.co')::uuid and delivery_class = 'express'), true);
select set_config('t.p', (select id::text from sales.orders where checkout_id = current_setting('t.co')::uuid and delivery_class = 'programado'), true);
select ok((select expires_at between now() + interval '14 minutes' and now() + interval '15 minutes 5 seconds' from sales.orders where id = current_setting('t.e')::uuid),
  'un express espera al comercio 15 minutos');
select ok((select expires_at > now() + interval '23 hours' from sales.orders where id = current_setting('t.p')::uuid),
  'un programado sigue con 24 horas');
update sales.orders set expires_at = now() + interval '2 hours' where id = current_setting('t.e')::uuid;
select ok((select expires_at <= now() + interval '15 minutes 5 seconds' from sales.orders where id = current_setting('t.e')::uuid),
  'ni a mano se le da más tiempo a un express');

-- Control 6.1.1: un pedido en preparación sin cambios por más de 30 minutos aparece para la operación.
set session_replication_role = replica;
update sales.orders set status = 'preparando' where id = current_setting('t.e')::uuid;
update sales.order_events set created_at = now() - interval '40 minutes' where order_id = current_setting('t.e')::uuid;
insert into sales.order_events (order_id, from_status, to_status, created_at) values (current_setting('t.e')::uuid, 'confirmado', 'preparando', now() - interval '35 minutes');
set session_replication_role = origin;
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select minutes >= 35 from public.stalled_orders() where id = current_setting('t.e')::uuid), true,
  'coordinación ve el pedido sin avance y cuántos minutos lleva');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*)::int from public.stalled_orders()), 0, 'el comercio no ve esa lista');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select is((select count(*)::int from public.stalled_orders()), 0, 'un cliente tampoco');
reset role;

-- Norma 2.3.3: con pedidos abiertos no se inhabilita al repartidor ni se suspende al comercio.
set session_replication_role = replica;
update sales.orders set status = 'en_camino', courier_id = current_setting('t.moto')::uuid where id = current_setting('t.e')::uuid;
set session_replication_role = origin;
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.set_courier_status(%L, 'inactivo', 'Deja el servicio')$$, current_setting('t.moto')), '22023', null::text,
  'un repartidor con un pedido en camino no se desactiva');
select throws_ok(format($$select public.set_commerce_status(%L, 'suspendido', 'Fin del convenio')$$, (select id from tc where k = 'a')), '22023', null::text,
  'un comercio con pedidos abiertos no se suspende');
reset role;
set session_replication_role = replica;
update sales.orders set status = 'entregado' where id = current_setting('t.e')::uuid;
update sales.orders set status = 'cancelado' where id = current_setting('t.p')::uuid;
set session_replication_role = origin;
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.set_courier_status(%L, 'inactivo', 'Deja el servicio')$$, current_setting('t.moto')),
  'resueltos sus pedidos, el repartidor sí se desactiva');
reset role;

-- Norma 7.1: la foto y el código de entrega no se apagan, ni siquiera directo en la tabla.
select throws_ok($$update sales.evidence_settings set require_delivery_photo = false$$, '23514', null::text,
  'la foto de entrega es obligatoria en la base de datos');

-- Norma 1.3.2: un incidente de seguridad dice qué información y a quiénes afecta; la fecha no puede ser futura.
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok($$select public.staff_report_incident('seguridad', 'alta', 'Alguien pidió la contraseña por WhatsApp', 'Pedidos')$$, '22023', null::text,
  'sin información involucrada ni afectados, un incidente de seguridad se rechaza');
select throws_ok($$select public.staff_report_incident('interrupcion', 'baja', 'La impresora no imprime los tickets', null, now() + interval '1 day')$$, '22023', null::text,
  'la fecha del incidente no puede ser futura');
select ok(public.staff_report_incident('seguridad', 'alta', 'Alguien pidió la contraseña por WhatsApp', 'Pedidos', now() - interval '2 hours', 'Credenciales', 'Una persona de coordinación') is not null,
  'con esos datos, se registra');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select data_involved || ' / ' || affected from public.it_incidents_list where description = 'Alguien pidió la contraseña por WhatsApp'),
  'Credenciales / Una persona de coordinación', 'la administración ve la información involucrada y los afectados');
reset role;

select * from finish();
rollback;
