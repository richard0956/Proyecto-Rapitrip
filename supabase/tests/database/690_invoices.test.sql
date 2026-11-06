-- Facturas de Rapitrip: emisión, notas de crédito, inmutabilidad, numeración y lectura (migración 20261101000094).
begin;
select plan(36);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '694@t.test') from unnest(array['adm', 'com', 'cli', 'cl2']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio 694');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda 694')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.s')::uuid, 'managua');
select set_config('t.p', public.create_product(current_setting('t.s')::uuid, 'Café 694')::text, true);
select set_config('t.v', public.create_variant(current_setting('t.p')::uuid, '500 g', 'CAFE-694', 200)::text, true);
select public.set_product_status(current_setting('t.p')::uuid, 'publicado');
reset role;

-- Tres pedidos: dos en efectivo y uno con tarjeta sin pagar. El envío lo fija después `create_checkout`; aquí se imita.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.o2', public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select set_config('t.o3', public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;

update sales.orders set delivery_fee = 30, total = subtotal + 30 where id = current_setting('t.o1')::uuid;
update sales.orders set delivery_fee = 0, total = subtotal where id = current_setting('t.o2')::uuid;
update sales.orders set delivery_fee = 25, total = subtotal + 25 where id = current_setting('t.o3')::uuid;

select is((select count(*)::int from sales.invoices where order_id in (current_setting('t.o1')::uuid, current_setting('t.o2')::uuid, current_setting('t.o3')::uuid)), 0, 'nada se emite antes del final de la transacción (el envío aún puede cambiar)');

set constraints all immediate;
set constraints all deferred;

select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o1')::uuid), 2, 'efectivo con envío: factura de venta y de servicio');
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o2')::uuid), 1, 'sin envío cobrado no hay factura de servicio');
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o3')::uuid), 0, 'tarjeta sin pagar: sin facturas');
select is((select sum(total) from sales.invoices where order_id = current_setting('t.o1')::uuid),
          (select total from sales.orders where id = current_setting('t.o1')::uuid), 'venta + servicio suman el total del pedido');
select matches((select number from sales.invoices where order_id = current_setting('t.o1')::uuid and kind = 'venta'), '^RT-V-[0-9]{6}$', 'numeración de la serie de venta');
select is((select data ->> 'legend' from sales.invoices where order_id = current_setting('t.o1')::uuid and kind = 'servicio'),
          'Comprobante interno de Rapitrip, sin validez fiscal', 'lleva la leyenda sin validez fiscal');
select is((select count(*)::int from sales.invoices where sha256 <> encode(sha256(convert_to(data::text, 'UTF8')), 'hex')), 0, 'la huella corresponde al contenido');

select private.issue_order_invoices(current_setting('t.o1')::uuid);
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o1')::uuid), 2, 'emitir dos veces no duplica');

-- Pago con tarjeta: recién entonces nacen las facturas.
select public.mark_order_paid(current_setting('t.o3')::uuid);
set constraints all immediate;
set constraints all deferred;
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o3')::uuid), 2, 'al confirmarse el pago con tarjeta se emiten las dos');
select is((select data ->> 'payment_method' from sales.invoices where order_id = current_setting('t.o3')::uuid and kind = 'venta'), 'tarjeta', 'queda el método de pago');

-- Inmutabilidad.
select throws_ok($$update sales.invoices set total = 0$$, '42501', null::text, 'una factura emitida no se modifica');
select throws_ok($$delete from sales.invoices$$, '42501', null::text, 'ni se borra');
select throws_ok($$truncate sales.invoices$$, '42501', null::text, 'ni se vacía el libro');

-- Cancelación: notas de crédito.
select tests.authenticate_as((select id from tu where k = 'cli'));
select public.set_order_status(current_setting('t.o1')::uuid, 'cancelado', 'ya no lo quiero');
select public.set_order_status(current_setting('t.o2')::uuid, 'cancelado', 'ya no lo quiero');
reset role;
set constraints all immediate;
set constraints all deferred;
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o1')::uuid and credit_for is not null), 2, 'cancelar emite una nota de crédito por factura');
select is((select count(*)::int from sales.invoices n join sales.invoices f on f.id = n.credit_for where n.order_id = current_setting('t.o1')::uuid and n.total <> f.total), 0,
          'cada nota de crédito es por el total de su factura');
select is((select data ->> 'credit_for_number' from sales.invoices where order_id = current_setting('t.o1')::uuid and kind = 'nota_credito_venta'),
          (select number from sales.invoices where order_id = current_setting('t.o1')::uuid and kind = 'venta'), 'la nota enlaza el número de la factura original');
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o2')::uuid and credit_for is not null), 1, 'sin factura de servicio, una sola nota');
select private.issue_credit_notes(current_setting('t.o1')::uuid, 'otra vez');
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o1')::uuid and credit_for is not null), 2, 'emitir notas dos veces no duplica');

-- Un pedido de tarjeta que nunca se pagó no tiene facturas ni notas.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o4', public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select public.set_order_status(current_setting('t.o4')::uuid, 'cancelado', 'me arrepentí');
reset role;
set constraints all immediate;
set constraints all deferred;
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o4')::uuid), 0, 'pago nunca completado: ni facturas ni notas');

-- Devolución aprobada: notas de crédito del pedido pagado con tarjeta.
insert into sales.return_requests (order_id, client_id, reason, photos)
values (current_setting('t.o3')::uuid, (select id from tu where k = 'cli'), 'Llegó dañado', array['x/1.jpg']);
update sales.return_requests set status = 'aprobada', decided_at = now(), decision_note = 'Aprobada en prueba' where order_id = current_setting('t.o3')::uuid;
select is((select count(*)::int from sales.invoices where order_id = current_setting('t.o3')::uuid and credit_for is not null), 2, 'aprobar la devolución emite las notas de crédito');

-- Numeración sin huecos: el contador coincide con lo emitido y una transacción deshecha no consume números.
select is((select count(*)::int from sales.invoices where kind = 'venta'), (select last_number from sales.document_counters where series = 'venta'), 'la serie de venta no tiene huecos');
create temp table cnt0 as select last_number from sales.document_counters where series = 'venta';
do $$ begin
  begin
    perform private.next_document_number('venta');
    raise exception 'deshacer';
  exception when raise_exception then null;
  end;
end $$;
select is((select last_number from sales.document_counters where series = 'venta'), (select last_number from cnt0), 'un número reservado en una operación deshecha no se pierde');

-- Lectura por rol, con un pedido nuevo de efectivo con envío.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o5', public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
update sales.orders set delivery_fee = 30, total = subtotal + 30 where id = current_setting('t.o5')::uuid;
set constraints all immediate;
set constraints all deferred;
select set_config('t.v5', (select id::text from sales.invoices where order_id = current_setting('t.o5')::uuid and kind = 'venta'), true);
select set_config('t.s5', (select id::text from sales.invoices where order_id = current_setting('t.o5')::uuid and kind = 'servicio'), true);

select tests.authenticate_as((select id from tu where k = 'cli'));
select is((select count(*)::int from public.order_invoices(current_setting('t.o5')::uuid)), 2, 'el cliente ve las dos facturas de su pedido');
select is((public.get_invoice(current_setting('t.v5')::uuid) ->> 'buyer_email'), 'cli694@t.test', 'el cliente ve sus propios datos en el documento');
reset role;

select tests.authenticate_as((select id from tu where k = 'cl2'));
select throws_ok(format($$select * from public.order_invoices(%L)$$, current_setting('t.o5')), '42501', null::text, 'otro cliente no ve las facturas');
reset role;

select tests.authenticate_as((select id from tu where k = 'com'));
select is((select count(*)::int from public.order_invoices(current_setting('t.o5')::uuid)), 1, 'el comercio ve solo la factura de venta');
select throws_ok(format($$select public.get_invoice(%L)$$, current_setting('t.s5')), '42501', null::text, 'el comercio no ve la factura de servicio');
select is((public.get_invoice(current_setting('t.v5')::uuid) ->> 'buyer_email'), null, 'el comercio no ve los datos del comprador');
select is(((public.get_invoice(current_setting('t.v5')::uuid) -> 'data') ? 'payment_intent_id'), false, 'ni la referencia de pago');
select throws_ok($$select * from public.invoice_ledger(now() - interval '1 day', now() + interval '1 day')$$, '42501', null::text, 'el comercio no abre el libro contable');
reset role;

select set_config('t.n_all', (select count(*) from sales.invoices)::text, true);
select set_config('t.n_card', (select count(*) from sales.invoices i join sales.orders o on o.id = i.order_id where o.payment_method = 'tarjeta')::text, true);
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select count(*)::int from public.order_invoices(current_setting('t.o5')::uuid)), 2, 'administración ve las dos');
select is((select count(*)::int from public.invoice_ledger(now() - interval '1 day', now() + interval '1 day')), current_setting('t.n_all')::int, 'el libro contable lista todo');
select is((select count(*)::int from public.invoice_ledger(now() - interval '1 day', now() + interval '1 day', null, 'tarjeta')),
          current_setting('t.n_card')::int, 'filtra por método de pago');
reset role;

-- Anonimizar la cuenta borra al comprador del documento; el documento y su huella quedan igual.
update identity.profiles set status = 'anonimizada' where id = (select id from tu where k = 'cli');
select is((select count(*)::int from sales.invoice_buyers where order_id in (select id from sales.orders where client_id = (select id from tu where k = 'cli'))), 0, 'al anonimizar se borran los datos del comprador');
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((public.get_invoice(current_setting('t.v5')::uuid) ->> 'buyer_anonymized')::boolean, true, 'el documento indica que el comprador fue anonimizado');
reset role;

select * from finish();
rollback;
