begin;
select plan(6);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.store')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select set_config('t.prod', public.create_product(current_setting('t.store')::uuid, 'Café')::text, true);
select set_config('t.var', public.create_variant(current_setting('t.prod')::uuid, '500 g', 'CAFE-500', 100)::text, true);
select public.set_product_status(current_setting('t.prod')::uuid, 'publicado');
reset role;

delete from private.email_outbox;

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.o1', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'efectivo', 'Barrio Central, casa 4', '88881111')::text, true);
select set_config('t.o2', public.create_order(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.var'))::jsonb, 'tarjeta', 'Barrio Central, casa 4', '88881111')::text, true);
reset role;

select is((select count(*)::int from private.email_outbox where template = 'order_received'), 1,
  'el pedido en efectivo envía "recibido" al crearse; el de tarjeta espera el pago');
select is((select to_email from private.email_outbox where template = 'order_received'), 'cli@t.test', 'el correo va al cliente');

select tests.authenticate_as((select id from tu where k = 'cli'));
select public.set_order_status(current_setting('t.o2')::uuid, 'cancelado', 'ya no lo quiero');
reset role;
select is((select count(*)::int from private.email_outbox where template = 'order_cancelled'), 1, 'cancelar encola el aviso');
select is((select data ->> 'reason' from private.email_outbox where template = 'order_cancelled'), 'ya no lo quiero', 'con el motivo');

select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.o1')::uuid, 'confirmado');
reset role;
select is((select count(*)::int from private.email_outbox), 2, 'confirmar no envía correo (solo recibido y cancelado)');

delete from private.email_outbox;
update identity.profile_pii set email = null where user_id = (select id from tu where k = 'cli');
select tests.authenticate_as((select id from tu where k = 'com'));
select public.set_order_status(current_setting('t.o1')::uuid, 'cancelado', 'sin stock del producto');
reset role;
select is((select count(*)::int from private.email_outbox), 0, 'sin correo en la cuenta no se encola nada');

select * from finish();
rollback;
