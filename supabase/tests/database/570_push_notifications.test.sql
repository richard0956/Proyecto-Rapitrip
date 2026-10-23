begin;
select plan(43);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'ra', tests.create_user('ra@t.test', 'Rep A');
insert into tu select 'rb', tests.create_user('rb@t.test', 'Rep B');
insert into tu select 'c1', tests.create_user('c1@t.test', 'Cliente Uno');
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
reset role;
update identity.couriers set user_id = (select id from tu where k = 'ra'), available = true, available_since = now() where id = current_setting('t.ca')::uuid;
update identity.couriers set user_id = (select id from tu where k = 'rb'), available = true, available_since = now() where id = current_setting('t.cb')::uuid;
select set_config('t.cart', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vc')), true);
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.k' || n, public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true) from generate_series(1, 3) n;
reset role;
select set_config('t.o' || n, (select id::text from sales.orders where checkout_id = current_setting('t.k' || n)::uuid), true) from generate_series(1, 3) n;
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(o::uuid, 'confirmado') from unnest(array[current_setting('t.o1'), current_setting('t.o2'), current_setting('t.o3')]) o;
reset role;

-- ===== Registrar dispositivos =====
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select lives_ok($$select set_config('t.s1', public.register_push_subscription('https://push.example.com/send/aaaaaaaaaaaaaaaa', repeat('A', 87), repeat('B', 22), 'Chrome Android')::text, true)$$, 'A activa los avisos en su teléfono');
select is((select count(*) from public.my_push_subscriptions), 1::bigint, 'y lo ve en su lista');
select is(public.register_push_subscription('https://push.example.com/send/aaaaaaaaaaaaaaaa', repeat('A', 87), repeat('B', 22), 'Chrome Android')::text, current_setting('t.s1'), 'registrar el mismo dispositivo otra vez no duplica');
select throws_ok($$select public.register_push_subscription('http://push.example.com/inseguro-no-vale', repeat('A', 87), repeat('B', 22))$$, '22023', null::text, 'la dirección debe ser https');
select throws_ok($$select public.register_push_subscription('https://push.example.com/send/bbbbbbbbbbbbbbbb', 'corta', repeat('B', 22))$$, '22023', null::text, 'las claves deben tener el formato correcto');
select is(has_column_privilege('authenticated', 'identity.push_subscriptions', 'p256dh', 'select'), false, 'las claves del dispositivo no se leen desde las pantallas');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select throws_ok($$select public.register_push_subscription('https://push.example.com/send/cccccccccccccccc', repeat('A', 87), repeat('B', 22))$$, '42501', null::text, 'un cliente no activa avisos de repartidor');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok($$select public.register_push_subscription('https://push.example.com/send/cccccccccccccccc', repeat('A', 87), repeat('B', 22))$$, '42501', null::text, 'la coordinación tampoco');
select is((select push_enabled from public.couriers_list where id = current_setting('t.ca')::uuid), true, 'la coordinación ve que A tiene los avisos activados');
select is((select push_enabled from public.couriers_list where id = current_setting('t.cb')::uuid), false, 'y que B no');
reset role;
select tests.authenticate_as((select id from tu where k = 'rb'), 'aal1');
select lives_ok($$select public.register_push_subscription('https://push.example.com/send/aaaaaaaaaaaaaaaa', repeat('C', 87), repeat('D', 22), 'Chrome Android')$$, 'si B inicia sesión en el mismo teléfono, el dispositivo pasa a B');
select is((select count(*) from public.my_push_subscriptions), 1::bigint, 'B lo ve');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select is((select count(*) from public.my_push_subscriptions), 0::bigint, 'y A ya no lo tiene');
select public.register_push_subscription('https://push.example.com/send/dev-' || n || '-xxxxxxxxxx', repeat('A', 87), repeat('B', 22)) from generate_series(1, 7) n;
select is((select count(*) from public.my_push_subscriptions), 5::bigint, 'cada repartidor conserva como máximo 5 dispositivos');
select set_config('t.ep', (select endpoint from public.my_push_subscriptions limit 1), true);
select lives_ok(format($$select public.unregister_push_subscription(%L)$$, current_setting('t.ep')), 'A quita un dispositivo');
select is((select count(*) from public.my_push_subscriptions), 4::bigint, 'y queda en 4');
select lives_ok(format($$select public.unregister_push_subscription(%L)$$, current_setting('t.ep')), 'quitarlo de nuevo no falla');
reset role;
select ok(not exists (select 1 from audit.events where action like 'courier.push_%' and (after_data::text like '%push.example.com%' or metadata::text like '%push.example.com%')), 'la auditoría no guarda direcciones de dispositivos');

-- Dejamos a A con un solo dispositivo y a B sin ninguno para las pruebas de envío.
delete from identity.push_subscriptions where user_id in (select id from tu where k in ('ra', 'rb'));
insert into identity.push_subscriptions (user_id, endpoint, p256dh, auth) values ((select id from tu where k = 'ra'), 'https://push.example.com/send/telefono-de-a', repeat('A', 87), repeat('B', 22));

-- ===== Encolar =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select set_config('t.f1', public.offer_order_to_courier(current_setting('t.o1')::uuid, current_setting('t.ca')::uuid)::text, true);
select set_config('t.f2', public.offer_order_to_courier(current_setting('t.o2')::uuid, current_setting('t.cb')::uuid)::text, true);
select is(public.push_kick(), true, 'la coordinación puede disparar el envío');
reset role;
select is((select count(*) from private.push_outbox where kind = 'oferta_nueva' and status = 'pendiente'), 2::bigint, 'cada propuesta nueva encola un aviso');
select ok((select o.expires_at = f.expires_at from private.push_outbox o join sales.order_offers f on f.id = o.offer_id where o.offer_id = current_setting('t.f1')::uuid), 'que vence cuando vence la propuesta');
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select throws_ok($$select public.push_kick()$$, '42501', null::text, 'un repartidor no dispara el envío');
reset role;

-- ===== Tomar y terminar (servicio) =====
select set_config('role', 'service_role', true);
select is((select count(*) from public.claim_push()), 1::bigint, 'el envío toma una fila por aviso y dispositivo: solo A tiene dispositivos');
select ok((select endpoint = 'https://push.example.com/send/telefono-de-a' and kind = 'oferta_nueva' from public.claim_push() limit 1) is null, 'lo tomado no se vuelve a entregar a otro envío en curso');
reset role;
select is((select status from private.push_outbox where offer_id = current_setting('t.f2')::uuid), 'sin_destino', 'quien no tiene dispositivos queda como «sin destino»');
select is((select status || ':' || attempts from private.push_outbox where offer_id = current_setting('t.f1')::uuid), 'enviando:1', 'el aviso de A queda en envío, con un intento');
select set_config('t.m1', (select id::text from private.push_outbox where offer_id = current_setting('t.f1')::uuid and kind = 'oferta_nueva'), true);
select set_config('role', 'service_role', true);
select lives_ok(format($$select public.finish_push(%L, true)$$, current_setting('t.m1')), 'se marca como enviado');
reset role;
select ok((select status = 'enviado' and sent_at is not null from private.push_outbox where offer_id = current_setting('t.f1')::uuid), 'con su hora');

-- Cancelar la propuesta pide cerrar la notificación.
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.cancel_order_offer(current_setting('t.f1')::uuid);
reset role;
select is((select count(*) from private.push_outbox where offer_id = current_setting('t.f1')::uuid and kind = 'oferta_cancelada' and status = 'pendiente'), 1::bigint, 'cancelar la propuesta encola el aviso de cierre');
update sales.order_offers set offered_at = now() - interval '5 minutes', expires_at = now() - interval '1 minute' where id = current_setting('t.f2')::uuid;
select private.expire_stale_offers();
select is((select count(*) from private.push_outbox where offer_id = current_setting('t.f2')::uuid and kind = 'oferta_cancelada'), 1::bigint, 'y también cuando la propuesta vence');

-- Reintentos y avisos vencidos.
select set_config('role', 'service_role', true);
select is((select count(*) from public.claim_push()), 1::bigint, 'el aviso de cierre de A también sale (el de B no tiene destino)');
reset role;
select set_config('t.cl', (select id::text from private.push_outbox where offer_id = current_setting('t.f1')::uuid and kind = 'oferta_cancelada'), true);
select set_config('role', 'service_role', true);
select public.finish_push(current_setting('t.cl')::uuid, false, 'el servicio respondió 503');
reset role;
select is((select status from private.push_outbox where id = current_setting('t.cl')::uuid), 'fallido', 'un envío que falla queda para reintentar');
select set_config('role', 'service_role', true);
select is((select count(*) from public.claim_push()), 1::bigint, 'y se reintenta');
reset role;
update private.push_outbox set status = 'pendiente', attempts = 3 where id = current_setting('t.cl')::uuid;
select set_config('role', 'service_role', true);
select is((select count(*) from public.claim_push()), 0::bigint, 'tras 3 intentos ya no se vuelve a tomar');
reset role;
update private.push_outbox set status = 'enviando', attempts = 1, claimed_at = now() - interval '5 minutes' where id = current_setting('t.cl')::uuid;
select set_config('role', 'service_role', true);
select is((select count(*) from public.claim_push()), 1::bigint, 'un envío abandonado hace más de 2 minutos se retoma');
reset role;
update private.push_outbox set status = 'pendiente', attempts = 0, expires_at = now() - interval '1 second' where id = current_setting('t.cl')::uuid;
select set_config('role', 'service_role', true);
select is((select count(*) from public.claim_push()), 0::bigint, 'un aviso vencido no se envía');
reset role;
select is((select status from private.push_outbox where id = current_setting('t.cl')::uuid), 'vencido', 'queda como vencido');

-- Dispositivos que el servicio push dio por inexistentes.
select set_config('t.gone', (select id::text from identity.push_subscriptions where endpoint = 'https://push.example.com/send/telefono-de-a'), true);
select set_config('role', 'service_role', true);
select public.finish_push(current_setting('t.cl')::uuid, false, 'respondió 410', array[current_setting('t.gone')::uuid]);
reset role;
select is((select count(*) from identity.push_subscriptions where id = current_setting('t.gone')::uuid), 0::bigint, 'un dispositivo dado por inexistente se borra');

-- ===== Perder la cuenta o la ficha borra los dispositivos =====
insert into identity.push_subscriptions (user_id, endpoint, p256dh, auth) values ((select id from tu where k = 'rb'), 'https://push.example.com/send/telefono-de-b', repeat('A', 87), repeat('B', 22));
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.set_courier_status(current_setting('t.cb')::uuid, 'inactivo', 'ya no trabaja con nosotros');
reset role;
select is((select count(*) from identity.push_subscriptions where user_id = (select id from tu where k = 'rb')), 0::bigint, 'desactivar al repartidor borra sus dispositivos');
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.revoke_courier_account(current_setting('t.ca')::uuid, 'perdió el teléfono');
reset role;
select is((select count(*) from identity.push_subscriptions where user_id = (select id from tu where k = 'ra')), 0::bigint, 'quitarle el acceso también');

-- ===== Permisos =====
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('register_push_subscription', 'unregister_push_subscription', 'claim_push', 'finish_push', 'push_kick')
    and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no ejecuta ninguna función de avisos');
select is(has_function_privilege('authenticated', 'public.claim_push(int)', 'execute') or has_function_privilege('authenticated', 'public.finish_push(uuid,boolean,text,uuid[])', 'execute'), false, 'el envío es solo del servicio, no de la API');
select is(has_table_privilege('authenticated', 'private.push_outbox', 'select') or has_table_privilege('anon', 'identity.push_subscriptions', 'select'), false, 'nadie lee la cola ni las suscripciones directamente');

select * from finish();
rollback;
