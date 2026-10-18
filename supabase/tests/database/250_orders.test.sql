begin;
select plan(51);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'otro', tests.create_user('otro@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'otro'), 'comercio', (select id from tc where k = 'b'));
insert into identity.couriers (full_name, phone, vehicle_type, created_by)
  values ('Repartidor de prueba', '88880000', 'moto', (select id from tu where k = 'adm'));

-- Catálogo del comercio A: una tienda abierta todo el día, un producto con stock controlado y otro sin control.
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.store')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prod', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 100)::text, true);
select set_config('t.prod2', public.create_product(current_setting('t.store')::uuid, 'Pan integral')::text, true);
select set_config('t.var2', public.create_variant(current_setting('t.prod2')::uuid, 'unidad', 'PAN-1', 10.5)::text, true);
select set_config('t.prod3', public.create_product(current_setting('t.store')::uuid, 'Borrador')::text, true);
select set_config('t.var3', public.create_variant(current_setting('t.prod3')::uuid, 'unidad', 'BOR-1', 5)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');
select public.set_product_status(current_setting('t.prod2')::uuid, 'publicado');
select public.set_stock_tracking(current_setting('t.var')::uuid, true, 2);
select public.add_stock(current_setting('t.var')::uuid, 10, 'compra inicial');
select lives_ok(format($$select public.set_store_delivery_fee(%L, 25)$$, current_setting('t.store')), 'el comercio fija el costo de envío');
select throws_ok(format($$select public.set_store_delivery_fee(%L, -1)$$, current_setting('t.store')), '22023', null::text, 'el envío no puede ser negativo');
reset role;

select tests.authenticate_as((select id from tu where k = 'otro'));
select throws_ok(format($$select public.set_store_delivery_fee(%L, 1)$$, current_setting('t.store')), '42501', null::text, 'otro comercio no cambia el envío ajeno');
reset role;

-- Crear pedidos
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111')$$,
  current_setting('t.store'), format('[{"variant_id":"%s","quantity":50}]', current_setting('t.var'))),
  '22023', null::text, 'no se reserva más stock del que hay');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111')$$,
  current_setting('t.store'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var3'))),
  '22023', null::text, 'un producto en borrador no se puede pedir');
select throws_ok(format($$select public.create_order(%L, '[]'::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111')$$, current_setting('t.store')),
  '22023', null::text, 'el pedido necesita productos');
select throws_ok(format($$select public.create_order(%L, %L::jsonb, 'trueque', 'Barrio Central, casa 4', '88881111')$$,
  current_setting('t.store'), format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var2'))),
  '22023', null::text, 'el método de pago debe ser válido');
select set_config('t.o1', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":3},{"variant_id":"%s","quantity":2},{"variant_id":"%s","quantity":1}]',
    current_setting('t.var'), current_setting('t.var2'), current_setting('t.var'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', 'tocar el timbre')::text, true);
select is((select total from public.orders_list where id = current_setting('t.o1')::uuid), 446.00::numeric,
  'total = 4 x 100 + 2 x 10,50 + 25 de envío (variantes repetidas se suman)');
select is((select status from public.orders_list where id = current_setting('t.o1')::uuid), 'por_confirmar', 'el pedido en efectivo nace por confirmar');
select is((select count(*)::int from public.order_items_list where order_id = current_setting('t.o1')::uuid), 2, 'un renglón por variante');
select is((select address from public.order_delivery_list where order_id = current_setting('t.o1')::uuid), 'Barrio Central, casa 4', 'el cliente ve su dirección');
select set_config('t.o2', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var2'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111')::text, true);
select is((select status from public.orders_list where id = current_setting('t.o2')::uuid), 'pendiente_pago', 'el pedido con tarjeta espera el pago');
reset role;

select is((select quantity from commerce.inventory where variant_id = current_setting('t.var')::uuid), 6, 'el pedido reservó 4 de las 10 unidades');
select is((select count(*)::int from commerce.stock_movements where variant_id = current_setting('t.var')::uuid and reason = 'Pedido ' || (select number from sales.orders where id = current_setting('t.o1')::uuid)), 1,
  'la reserva deja su movimiento de inventario');

-- Aislamiento
select tests.authenticate_as((select id from tu where k = 'cli2'));
select is((select count(*)::int from public.orders_list), 0, 'otro cliente no ve pedidos ajenos');
select throws_ok(format($$select public.set_order_status(%L, 'cancelado', 'no es mi pedido')$$, current_setting('t.o1')), '42501', null::text,
  'otro cliente no cancela pedidos ajenos');
reset role;
select tests.authenticate_as((select id from tu where k = 'otro'));
select is((select count(*)::int from public.orders_list), 0, 'otro comercio no ve estos pedidos');
reset role;
select is(tests.count_as((select id from tu where k = 'caj'), 'public.orders_list'), 0::bigint, 'el cajero no ve pedidos por ahora');
select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*)::int from public.orders_list), 2, 'el comercio ve los pedidos de su tienda');
select is((select count(*)::int from public.order_delivery_list), 0, 'el comercio no ve la dirección ni el teléfono del cliente');

-- Flujo del comercio
select throws_ok(format($$select public.set_order_status(%L, 'listo')$$, current_setting('t.o1')), '42501', null::text, 'no se salta pasos');
select lives_ok(format($$select public.set_order_status(%L, 'confirmado')$$, current_setting('t.o1')), 'el comercio confirma');
select lives_ok(format($$select public.set_order_status(%L, 'preparando')$$, current_setting('t.o1')), 'el comercio prepara');
select lives_ok(format($$select public.set_order_status(%L, 'listo')$$, current_setting('t.o1')), 'el comercio lo deja listo');
select throws_ok(format($$select public.set_order_status(%L, 'en_camino')$$, current_setting('t.o1')), '42501', null::text, 'el comercio no despacha');
reset role;

-- Coordinación despacha y entrega
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select address from public.order_delivery_list where order_id = current_setting('t.o1')::uuid), 'Barrio Central, casa 4', 'coordinación ve la dirección de entrega');
select throws_ok(format($$select public.set_order_status(%L, 'en_camino')$$, current_setting('t.o1')), '22023', null::text, 'no se despacha sin repartidor');
select lives_ok(format($$select public.assign_order_courier(%L, %L)$$, current_setting('t.o1'), (select id from identity.couriers limit 1)), 'asigna repartidor');
select lives_ok(format($$select public.set_order_status(%L, 'en_camino')$$, current_setting('t.o1')), 'despacha');
select lives_ok(format($$select public.set_order_status(%L, 'entregado')$$, current_setting('t.o1')), 'entrega');
select is((select payment_status from public.orders_list where id = current_setting('t.o1')::uuid), 'pagado', 'entregar un pedido en efectivo lo da por cobrado');
select throws_ok(format($$select public.set_order_status(%L, 'cancelado', 'ya entregado')$$, current_setting('t.o1')), '22023', null::text, 'un pedido terminado no cambia');
select is((select array_agg(to_status order by id) from public.order_events_list where order_id = current_setting('t.o1')::uuid),
  array['por_confirmar', 'confirmado', 'preparando', 'listo', 'en_camino', 'entregado'], 'el historial conserva cada estado');
reset role;

-- Cancelar libera el stock; la tarjeta se paga por el webhook
select tests.authenticate_as((select id from tu where k = 'cli'));
select throws_ok(format($$select public.set_order_status(%L, 'cancelado', 'abc')$$, current_setting('t.o2')), '22023', null::text, 'cancelar exige motivo');
select lives_ok(format($$select public.set_order_status(%L, 'cancelado', 'me equivoqué de pedido')$$, current_setting('t.o2')), 'el cliente cancela su pedido sin pagar');
reset role;
select ok(not has_function_privilege('authenticated', 'public.mark_order_paid(uuid)', 'execute'), 'solo el servicio marca pagos');

-- Vencimiento
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o3', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":2}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111')::text, true);
reset role;
select is((select quantity from commerce.inventory where variant_id = current_setting('t.var')::uuid), 4, 'el nuevo pedido reservó 2 más');
update sales.orders set expires_at = now() - interval '1 minute' where id = current_setting('t.o3')::uuid;
select is(private.expire_stale_orders(), 1, 'vence el pedido sin pagar');
select is((select quantity from commerce.inventory where variant_id = current_setting('t.var')::uuid), 6, 'al vencer se libera la reserva');

-- Cancelar solo devuelve lo que se reservó: si el comercio activa el control de stock DESPUÉS de crearse el pedido, no se infla el inventario.
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.prodx', public.create_product(current_setting('t.store')::uuid, 'Galletas')::text, true);
select set_config('t.varx', public.create_variant(current_setting('t.prodx')::uuid, 'Unidad', 'GALL-1', 10)::text, true);
select public.set_product_status(current_setting('t.prodx')::uuid, 'publicado');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli2'));
select lives_ok(format($$select set_config('t.o4', public.create_order(%L, '[{"variant_id":"%s","quantity":3}]'::jsonb, 'efectivo', 'Barrio Central, casa 9', '88882222')::text, true)$$,
  current_setting('t.store'), current_setting('t.varx')), 'pedido de una variante sin control de stock');
reset role;
select is((select stock_reserved from sales.order_items where order_id = current_setting('t.o4')::uuid), false, 'sin control no se marca reserva');
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_stock_tracking(current_setting('t.varx')::uuid, true, 2);
select is(public.count_stock(current_setting('t.varx')::uuid, 10, 'conteo físico inicial'), 10, 'el comercio activa el control y cuenta 10');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli2'));
select lives_ok(format($$select public.set_order_status(%L, 'cancelado', 'ya no lo necesito')$$, current_setting('t.o4')), 'el cliente cancela el pedido anterior al control');
reset role;
select is((select quantity from commerce.inventory where variant_id = current_setting('t.varx')::uuid), 10,
  'cancelar un pedido que no reservó stock no suma unidades');
select tests.authenticate_as((select id from tu where k = 'cli2'));
select set_config('t.o5', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":4}]', current_setting('t.varx'))::jsonb, 'efectivo', 'Barrio Central, casa 9', '88882222')::text, true);
reset role;
select is((select quantity from commerce.inventory where variant_id = current_setting('t.varx')::uuid), 6, 'con control, el pedido reserva 4');
select tests.authenticate_as((select id from tu where k = 'cli2'));
select lives_ok(format($$select public.set_order_status(%L, 'cancelado', 'cambié de opinión')$$, current_setting('t.o5')), 'el cliente cancela el pedido con reserva');
reset role;
select is((select quantity from commerce.inventory where variant_id = current_setting('t.varx')::uuid), 10, 'cancelar devuelve exactamente lo reservado');

-- Auditoría y anonimización
select ok(exists (select 1 from audit.events where action = 'order.entregado' and target_id = current_setting('t.o1')),
  'los cambios de estado quedan auditados');
select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.confirm_anonymization(%L, 'solicitud de la titular', true)$$, (select id from tu where k = 'cli')),
  'la administración anonimiza al cliente');
reset role;
select is((select count(*)::int from sales.order_delivery d join sales.orders o on o.id = d.order_id where o.client_id = (select id from tu where k = 'cli')), 0,
  'anonimizar borra los datos de entrega');
select is((select count(*)::int from sales.orders where client_id = (select id from tu where k = 'cli')), 3, 'los pedidos y sus montos se conservan');

select * from finish();
rollback;
