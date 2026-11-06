-- Los correos «pedido recibido» y «pedido cancelado» llevan los números de las facturas y de las notas de crédito (migración 95).
begin;
select plan(7);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '700@t.test') from unnest(array['com', 'cli']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio 700');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda 700')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select public.set_store_department(current_setting('t.s')::uuid, 'managua');
select set_config('t.p', public.create_product(current_setting('t.s')::uuid, 'Café 700')::text, true);
select set_config('t.v', public.create_variant(current_setting('t.p')::uuid, '500 g', 'CAFE-700', 200)::text, true);
select public.set_product_status(current_setting('t.p')::uuid, 'publicado');
reset role;

delete from private.email_outbox;

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'efectivo', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
reset role;
update sales.orders set delivery_fee = 30, total = subtotal + 30 where id = current_setting('t.o1')::uuid;

select is((select data -> 'invoices' from private.email_outbox where template = 'order_received'), null, 'mientras la transacción sigue abierta, el correo aún no lleva facturas');

set constraints all immediate;
set constraints all deferred;

select is((select jsonb_array_length(data -> 'invoices') from private.email_outbox where template = 'order_received'), 2, 'el correo «recibido» lleva las dos facturas');
select is((select data -> 'invoices' -> 0 ->> 'number' from private.email_outbox where template = 'order_received'),
          (select number from sales.invoices where order_id = current_setting('t.o1')::uuid and kind = 'venta'), 'la primera es la de venta');
select is((select data ->> 'number' from private.email_outbox where template = 'order_received'),
          (select number::text from sales.orders where id = current_setting('t.o1')::uuid), 'el resto del correo no cambia');

-- Cancelación: el correo lleva las notas de crédito.
select tests.authenticate_as((select id from tu where k = 'cli'));
select public.set_order_status(current_setting('t.o1')::uuid, 'cancelado', 'ya no lo quiero');
reset role;
set constraints all immediate;
set constraints all deferred;
select is((select jsonb_array_length(data -> 'credit_notes') from private.email_outbox where template = 'order_cancelled'), 2, 'el correo «cancelado» lleva las dos notas de crédito');
select matches((select data -> 'credit_notes' -> 0 ->> 'number' from private.email_outbox where template = 'order_cancelled'), '^RT-NCV-[0-9]{6}$', 'con su número');

-- Un pedido de tarjeta que nunca se pagó se cancela sin notas: el correo no lleva el campo.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o2', public.create_order(current_setting('t.s')::uuid, format('[{"variant_id":"%s","quantity":1}]', current_setting('t.v'))::jsonb,
  'tarjeta', 'Barrio Central, casa 4', '88881111', null, null, 12.136400, -86.251400)::text, true);
select public.set_order_status(current_setting('t.o2')::uuid, 'cancelado', 'me arrepentí');
reset role;
set constraints all immediate;
set constraints all deferred;
select is((select jsonb_array_length(data -> 'credit_notes') from private.email_outbox where template = 'order_cancelled' and data ->> 'order_id' = current_setting('t.o2')),
          0, 'sin facturas, la lista de notas va vacía');

select * from finish();
rollback;
