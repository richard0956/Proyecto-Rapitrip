begin;
select plan(76);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'com2', tests.create_user('com2@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'ra', tests.create_user('ra@t.test', 'Rep A');
insert into tu select 'rb', tests.create_user('rb@t.test', 'Rep B');
insert into tu select 'c1', tests.create_user('c1@t.test', 'Cliente Uno');
insert into tu select 'c2', tests.create_user('c2@t.test', 'Cliente Dos');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'com2'), 'comercio', (select id from tc where k = 'b'));
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
update identity.couriers set user_id = (select id from tu where k = 'ra') where id = current_setting('t.ca')::uuid;
update identity.couriers set user_id = (select id from tu where k = 'rb') where id = current_setting('t.cb')::uuid;
select set_config('t.cart', format('[{"store_id":"%s","items":[{"variant_id":"%s","quantity":1}]}]', current_setting('t.s'), current_setting('t.vc')), true);

-- o1 (c1), o2 y o3 (c1), todos de A; c2 tiene o4 (ajeno).
select tests.authenticate_as((select id from tu where k = 'c1'));
select set_config('t.k' || n, public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true)
  from generate_series(1, 3) n;
reset role;
select tests.authenticate_as((select id from tu where k = 'c2'));
select set_config('t.k4', public.create_checkout(current_setting('t.cart')::jsonb, 'efectivo', 'Colonia Nueva', '88882222', null, null, 12.140000, -86.250000, 'managua') ->> 'checkout_id', true);
reset role;
select set_config('t.o' || n, (select id::text from sales.orders where checkout_id = current_setting('t.k' || n)::uuid), true) from generate_series(1, 4) n;

select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(o::uuid, 'confirmado') from unnest(array[current_setting('t.o1'), current_setting('t.o2'), current_setting('t.o3'), current_setting('t.o4')]) o;
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.assign_order_courier(o::uuid, current_setting('t.ca')::uuid) from unnest(array[current_setting('t.o1'), current_setting('t.o2'), current_setting('t.o3')]) o;
reset role;

-- ===== Códigos =====
select is((select count(*) from sales.order_codes where order_id = current_setting('t.o1')::uuid), 0::bigint, 'antes de estar listo el pedido no tiene códigos');
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(o::uuid, s) from unnest(array[current_setting('t.o1'), current_setting('t.o1'), current_setting('t.o3'), current_setting('t.o3')], array['preparando', 'listo', 'preparando', 'listo']) as x(o, s);
reset role;
select ok((select pickup_code ~ '^[0-9]{4}$' and delivery_code ~ '^[0-9]{4}$' from sales.order_codes where order_id = current_setting('t.o1')::uuid), 'al quedar listo se generan los dos códigos de 4 dígitos');
select set_config('t.pick1', (select pickup_code from sales.order_codes where order_id = current_setting('t.o1')::uuid), true);
select set_config('t.del1', (select delivery_code from sales.order_codes where order_id = current_setting('t.o1')::uuid), true);

select tests.authenticate_as((select id from tu where k = 'com'));
select is(public.order_pickup_code(current_setting('t.o1')::uuid), current_setting('t.pick1'), 'el comercio ve el código de recogida de su pedido listo');
select is(public.order_pickup_code(current_setting('t.o2')::uuid), null, 'un pedido que aún no está listo no tiene código que mostrar');
reset role;
select tests.authenticate_as((select id from tu where k = 'com2'));
select throws_ok(format($$select public.order_pickup_code(%L)$$, current_setting('t.o1')), '42501', null::text, 'otro comercio no ve el código');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.order_pickup_code(%L)$$, current_setting('t.o1')), '42501', null::text, 'la coordinación tampoco ve el código de recogida');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select throws_ok(format($$select public.order_pickup_code(%L)$$, current_setting('t.o1')), '42501', null::text, 'el cliente no ve el código de recogida');
select is(public.my_delivery_code(current_setting('t.o1')::uuid), null, 'el código de entrega no se muestra antes de que el pedido vaya en camino');
reset role;
select is(has_table_privilege('authenticated', 'sales.order_codes', 'select'), false, 'nadie lee la tabla de códigos directamente');

-- ===== Recogida =====
insert into storage.objects (bucket_id, name) values
  ('entregas', current_setting('t.ca') || '/' || current_setting('t.o1') || '/recogida.jpg'),
  ('entregas', current_setting('t.ca') || '/' || current_setting('t.o1') || '/entrega.jpg'),
  ('entregas', current_setting('t.ca') || '/' || current_setting('t.o3') || '/entrega.jpg'),
  ('entregas', current_setting('t.ca') || '/' || current_setting('t.o2') || '/temprano.jpg'),
  ('entregas', current_setting('t.cb') || '/' || current_setting('t.o1') || '/ajena.jpg');

select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select lives_ok(format($$select set_config('t.e1', public.courier_add_evidence(%L, 'recogida', %L, repeat('a', 64), 12.136500, -86.251500, 2, 'Dos bolsas selladas')::text, true)$$,
  current_setting('t.o1'), current_setting('t.ca') || '/' || current_setting('t.o1') || '/recogida.jpg'), 'A registra la foto de recogida en la tienda');
select is(public.courier_add_evidence(current_setting('t.o1')::uuid, 'recogida', current_setting('t.ca') || '/' || current_setting('t.o1') || '/recogida.jpg', repeat('a', 64), 12.136500, -86.251500, 2, 'Dos bolsas selladas')::text,
  current_setting('t.e1'), 'repetir el mismo envío devuelve la misma evidencia');
select throws_ok(format($$select public.courier_add_evidence(%L, 'recogida', %L, repeat('b', 64))$$,
  current_setting('t.o1'), current_setting('t.ca') || '/' || current_setting('t.o1') || '/recogida.jpg'), '23505', null::text, 'no se registra una segunda recogida distinta');
select throws_ok(format($$select public.courier_add_evidence(%L, 'recogida', %L, repeat('a', 64))$$,
  current_setting('t.o2'), current_setting('t.ca') || '/' || current_setting('t.o2') || '/temprano.jpg'), '22023', null::text, 'no se recoge un pedido que aún no está listo');
select throws_ok(format($$select public.courier_add_evidence(%L, 'entrega', %L, repeat('c', 64))$$,
  current_setting('t.o1'), current_setting('t.ca') || '/' || current_setting('t.o1') || '/entrega.jpg'), '22023', null::text, 'ni se entrega lo que no va en camino');
select throws_ok(format($$select public.courier_add_evidence(%L, 'recogida', %L, 'no-es-hash')$$,
  current_setting('t.o3'), current_setting('t.ca') || '/' || current_setting('t.o3') || '/entrega.jpg'), '22023', null::text, 'la huella debe ser SHA-256');
select throws_ok(format($$select public.courier_add_evidence(%L, 'recogida', %L, repeat('d', 64))$$,
  current_setting('t.o3'), current_setting('t.cb') || '/' || current_setting('t.o1') || '/ajena.jpg'), '22023', null::text, 'la ruta debe estar en su propia carpeta y pedido');
select throws_ok(format($$select public.courier_add_evidence(%L, 'recogida', %L, repeat('d', 64))$$,
  current_setting('t.o3'), current_setting('t.ca') || '/' || current_setting('t.o3') || '/no-existe.jpg'), '22023', null::text, 'la foto debe estar ya subida');
select throws_ok(format($$select public.courier_add_evidence(%L, 'recogida', %L, repeat('d', 64), 12.1)$$,
  current_setting('t.o3'), current_setting('t.ca') || '/' || current_setting('t.o3') || '/entrega.jpg'), '22023', null::text, 'la ubicación se envía completa o no se envía');
select throws_ok(format($$select public.courier_add_evidence(%L, 'fallida', %L, repeat('d', 64), 12.1, -86.2, 1, 'x')$$,
  current_setting('t.o3'), current_setting('t.ca') || '/' || current_setting('t.o3') || '/entrega.jpg'), '22023', null::text, 'la nota debe tener al menos 3 caracteres');
reset role;
select tests.authenticate_as((select id from tu where k = 'rb'), 'aal1');
select throws_ok(format($$select public.courier_add_evidence(%L, 'recogida', %L, repeat('e', 64))$$,
  current_setting('t.o1'), current_setting('t.cb') || '/' || current_setting('t.o1') || '/ajena.jpg'), 'P0002', null::text, 'B no registra evidencias del pedido de A');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.courier_add_evidence(%L, 'recogida', 'x/y/z.jpg', repeat('e', 64))$$, current_setting('t.o1')), '42501', null::text, 'la coordinación no registra evidencias como repartidor');
reset role;
select ok((select not flagged and distance_m < 100 and units_count = 2 from sales.delivery_evidence where id = current_setting('t.e1')::uuid), 'la recogida cerca de la tienda no se marca y guarda el conteo');
select ok((select purge_after between now() + interval '89 days' and now() + interval '91 days' from sales.delivery_evidence where id = current_setting('t.e1')::uuid), 'se conserva 90 días (3 meses)');

-- ===== Códigos: comprobación y bloqueo =====
select is(private.verify_order_code(current_setting('t.o1')::uuid, 'recogida', '0000x'), 'incorrecto', 'un código incorrecto se rechaza');
select is(private.verify_order_code(current_setting('t.o1')::uuid, 'recogida', null), 'incorrecto', 'un código vacío también');
select is((select pickup_attempts from sales.order_codes where order_id = current_setting('t.o1')::uuid), 2, 'y cada intento queda contado');
select is(private.verify_order_code(current_setting('t.o1')::uuid, 'recogida', current_setting('t.pick1')), 'ok', 'el código correcto se acepta');
select is(private.verify_order_code(current_setting('t.o3')::uuid, 'entrega', 'xxxx'), 'incorrecto', 'intento 1 de entrega');
select private.verify_order_code(current_setting('t.o3')::uuid, 'entrega', 'xxxx') from generate_series(1, 4);
select is(private.verify_order_code(current_setting('t.o3')::uuid, 'entrega', (select delivery_code from sales.order_codes where order_id = current_setting('t.o3')::uuid)), 'bloqueado',
  'tras 5 intentos fallidos el código queda bloqueado, aunque ahora se escriba bien');
select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.reset_order_code_attempts(%L, 'entrega', 'ok')$$, current_setting('t.o3')), '22023', null::text, 'liberar un código exige motivo');
select lives_ok(format($$select public.reset_order_code_attempts(%L, 'entrega', 'el cliente confirmó por teléfono')$$, current_setting('t.o3')), 'la coordinación libera el código con motivo');
reset role;
select is(private.verify_order_code(current_setting('t.o3')::uuid, 'entrega', (select delivery_code from sales.order_codes where order_id = current_setting('t.o3')::uuid)), 'ok', 'y vuelve a funcionar');
select is(private.verify_order_code(current_setting('t.o4')::uuid, 'entrega', '1234'), 'sin_codigo', 'un pedido sin códigos responde «sin_codigo»');

-- ===== Entrega =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select public.set_order_status(current_setting('t.o1')::uuid, 'en_camino', 'despacho de prueba');
select public.set_order_status(current_setting('t.o3')::uuid, 'en_camino', 'despacho de prueba');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select is(public.my_delivery_code(current_setting('t.o1')::uuid), current_setting('t.del1'), 'en camino, el cliente ve su código de entrega');
reset role;
select tests.authenticate_as((select id from tu where k = 'c2'));
select throws_ok(format($$select public.my_delivery_code(%L)$$, current_setting('t.o1')), '42501', null::text, 'otro cliente no ve ese código');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select lives_ok(format($$select set_config('t.e2', public.courier_add_evidence(%L, 'entrega', %L, repeat('1', 64), 12.200000, -86.200000)::text, true)$$,
  current_setting('t.o1'), current_setting('t.ca') || '/' || current_setting('t.o1') || '/entrega.jpg'), 'A registra la foto de entrega (lejos del punto)');
select lives_ok(format($$select set_config('t.e3', public.courier_add_evidence(%L, 'entrega', %L, repeat('2', 64))::text, true)$$,
  current_setting('t.o3'), current_setting('t.ca') || '/' || current_setting('t.o3') || '/entrega.jpg'), 'y otra sin ubicación');
select is((select count(*) from public.courier_order_evidence(current_setting('t.o1')::uuid)), 2::bigint, 'el repartidor ve lo que ya subió de su pedido');
select throws_ok(format($$select * from public.courier_order_evidence(%L)$$, current_setting('t.o4')), 'P0002', null::text, 'pero no de un pedido ajeno');
reset role;
select ok((select flagged and flag_reason = 'lejos_del_punto' and distance_m > 150 from sales.delivery_evidence where id = current_setting('t.e2')::uuid), 'una entrega a más de 150 m del punto se marca para revisión');
select ok((select flagged and flag_reason = 'sin_ubicacion' from sales.delivery_evidence where id = current_setting('t.e3')::uuid), 'sin ubicación también se marca');
select is((select count(*) from audit.events where action = 'order.evidence_added'), 3::bigint, 'cada evidencia queda auditada');
select is((select count(*) from audit.events where after_data ? 'file_path' or after_data ? 'latitude' or after_data::text like '%' || current_setting('t.pick1') || '%'), 0::bigint, 'la auditoría no lleva rutas, coordenadas ni códigos');

-- ===== De solo adición =====
select throws_ok(format($$update sales.delivery_evidence set note = 'editada' where id = %L$$, current_setting('t.e1')), '42501', null::text, 'ni el dueño de la base edita una evidencia');
select throws_ok(format($$delete from sales.delivery_evidence where id = %L$$, current_setting('t.e1')), '42501', null::text, 'ni la borra');
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$update sales.delivery_evidence set flagged = false where id = %L$$, current_setting('t.e2')), '42501', null::text, 'un administrador tampoco puede limpiar una marca');
reset role;
select is(has_column_privilege('authenticated', 'sales.delivery_evidence', 'latitude', 'select'), false, 'las coordenadas del repartidor no salen hacia las pantallas');

-- ===== Quién ve las evidencias =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select count(*) from public.order_evidence_list), 3::bigint, 'la coordinación ve todas');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select is((select string_agg(kind, ',' order by kind) from public.order_evidence_list), 'entrega,entrega', 'el cliente ve las entregas de sus pedidos, no la recogida');
reset role;
select tests.authenticate_as((select id from tu where k = 'c2'));
select is((select count(*) from public.order_evidence_list), 0::bigint, 'otro cliente no ve nada');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select is((select string_agg(kind, ',') from public.order_evidence_list), 'recogida', 'el comercio ve solo la recogida de sus pedidos');
reset role;
select tests.authenticate_as((select id from tu where k = 'com2'));
select is((select count(*) from public.order_evidence_list), 0::bigint, 'otro comercio no ve nada');
reset role;

-- ===== Fotos en el almacenamiento =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select count(*) from storage.objects where bucket_id = 'entregas'), 5::bigint, 'la coordinación abre todas las fotos');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select is((select count(*) from storage.objects where bucket_id = 'entregas' and name like '%/entrega.jpg'), 2::bigint, 'el cliente abre las fotos de entrega de sus pedidos');
select is((select count(*) from storage.objects where bucket_id = 'entregas' and name like '%/recogida.jpg'), 0::bigint, 'pero no la de recogida');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*) from storage.objects where bucket_id = 'entregas'), 1::bigint, 'el comercio abre solo la foto de recogida');
reset role;
select tests.authenticate_as((select id from tu where k = 'ra'), 'aal1');
select lives_ok(format($$insert into storage.objects (bucket_id, name) values ('entregas', %L)$$, current_setting('t.ca') || '/' || current_setting('t.o2') || '/nueva.jpg'), 'el repartidor sube a su propia carpeta');
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('entregas', %L)$$, current_setting('t.cb') || '/' || current_setting('t.o2') || '/intruso.jpg'), '42501', null::text, 'pero no a la de otro');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select throws_ok(format($$insert into storage.objects (bucket_id, name) values ('entregas', %L)$$, current_setting('t.ca') || '/' || current_setting('t.o1') || '/falsa.jpg'), '42501', null::text, 'un cliente no sube fotos');
reset role;

-- ===== Estado de la cadena y reglas =====
select tests.authenticate_as((select id from tu where k = 'coo'));
select ok((select has_pickup and has_delivery and complete from public.order_evidence_status where order_id = current_setting('t.o1')::uuid), 'o1: recogida y entrega registradas, cadena completa');
select ok((select not has_pickup and has_delivery and not complete from public.order_evidence_status where order_id = current_setting('t.o3')::uuid), 'o3: en camino sin foto de recogida, cadena incompleta');
select is((select flagged_count from public.order_evidence_status where order_id = current_setting('t.o3')::uuid), 1, 'y con una marca por revisar');
select throws_ok($$select public.set_evidence_settings(true, true, true, true, 150, 90)$$, '42501', null::text, 'la coordinación no cambia las reglas');
reset role;
select tests.authenticate_as((select id from tu where k = 'c1'));
select is((select count(*) from public.order_evidence_status), 0::bigint, 'un cliente no ve el estado de la cadena');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select public.set_evidence_settings(true, true, true, true, 5, 90)$$, '22023', null::text, 'la distancia de alerta tiene límites');
select throws_ok($$select public.set_evidence_settings(true, true, true, true, 150, 3)$$, '22023', null::text, 'la conservación también');
select lives_ok($$select public.set_evidence_settings(false, true, true, true, 150, 90)$$, 'la administración puede dejar de exigir la foto de recogida');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select ok((select complete from public.order_evidence_status where order_id = current_setting('t.o3')::uuid), 'y entonces o3 deja de estar incompleta');
reset role;

-- ===== Retención =====
select set_config('rapitrip.evidence_maint', 'on', false);
update sales.delivery_evidence set purge_after = now() - interval '1 day' where id in (current_setting('t.e1')::uuid, current_setting('t.e2')::uuid);
select set_config('rapitrip.evidence_maint', 'off', false);
select set_config('role', 'service_role', true);
select is((select count(*) from public.evidence_pending_purge()), 2::bigint, 'el mantenimiento ve las 2 fotos vencidas');
select is(public.mark_evidence_purged(array(select evidence_id from public.evidence_pending_purge())), 2, 'las marca como eliminadas');
select is(public.mark_evidence_purged(array[current_setting('t.e1')::uuid]), 0, 'marcar de nuevo no hace nada');
reset role;
select ok((select purged_at is not null and sha256 = repeat('a', 64) from sales.delivery_evidence where id = current_setting('t.e1')::uuid), 'queda la huella aunque la foto se eliminó');
select is(has_function_privilege('authenticated', 'public.evidence_pending_purge(int)', 'execute') or has_function_privilege('anon', 'public.mark_evidence_purged(uuid[])', 'execute'), false, 'el mantenimiento no es ejecutable desde la API');
select set_config('rapitrip.evidence_maint', 'on', false);
update sales.delivery_evidence set purge_after = now() + interval '30 days' where id = current_setting('t.e3')::uuid;
select set_config('rapitrip.evidence_maint', 'off', false);
update identity.profiles set status = 'anonimizada' where id = (select id from tu where k = 'c1');
select ok((select purge_after <= now() from sales.delivery_evidence where id = current_setting('t.e3')::uuid), 'al anonimizar al cliente, sus fotos pasan a eliminarse');

-- ===== Permisos =====
select is_empty($$
  select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('set_evidence_settings', 'reset_order_code_attempts', 'order_pickup_code', 'my_delivery_code', 'courier_add_evidence',
                      'courier_order_evidence', 'evidence_pending_purge', 'mark_evidence_purged')
    and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no ejecuta ninguna función de evidencias');
select is(has_table_privilege('anon', 'sales.delivery_evidence', 'select'), false, 'anon no lee la tabla de evidencias');

select * from finish();
rollback;
