begin;
select plan(29);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'otro', tests.create_user('otro@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'otro'), 'comercio', (select id from tc where k = 'b'));

-- Una tienda abierta con tres productos: Café (una presentación), Pan (una) y Jugo (dos presentaciones).
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.s')::uuid, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_location(current_setting('t.s')::uuid, 12.136400, -86.251400);
select set_config('t.pc', public.create_product(current_setting('t.s')::uuid, 'Café')::text, true);
select set_config('t.vc', public.create_variant(current_setting('t.pc')::uuid, '500 g', 'CAFE-500', 100)::text, true);
select set_config('t.pp', public.create_product(current_setting('t.s')::uuid, 'Pan')::text, true);
select set_config('t.vp', public.create_variant(current_setting('t.pp')::uuid, 'Unidad', 'PAN-1', 20)::text, true);
select set_config('t.pj', public.create_product(current_setting('t.s')::uuid, 'Jugo')::text, true);
select set_config('t.vj1', public.create_variant(current_setting('t.pj')::uuid, 'Pequeño', 'JUGO-P', 30)::text, true);
select set_config('t.vj2', public.create_variant(current_setting('t.pj')::uuid, 'Grande', 'JUGO-G', 60)::text, true);
select public.set_product_status(p::uuid, 'publicado') from unnest(array[current_setting('t.pc'), current_setting('t.pp'), current_setting('t.pj')]) p;

-- Reglas: una baja de menos de 5 % no es descuento; desde 5 % sí
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 100);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), null::numeric, 'guardar sin cambiar el precio no crea descuento');
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 96);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), null::numeric, 'bajar un 4 % no es descuento');
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 100);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), null::numeric, 'volver al precio anterior tampoco');
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 95);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), 100::numeric, 'bajar exactamente un 5 % activa el descuento y guarda el precio anterior');
select is((select discount_pct from public.product_variants_list where id = current_setting('t.vc')::uuid), 5, 'el porcentaje se calcula (5 %)');
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 80);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), 100::numeric, 'bajar más conserva el precio de lista original');
select is((select discount_pct from public.product_variants_list where id = current_setting('t.vc')::uuid), 20, 'ahora es 20 %');
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 90);
select is((select compare_at_price || '/' || discount_pct from public.product_variants_list where id = current_setting('t.vc')::uuid), '100.00/10', 'subir el precio sin llegar al de lista deja un descuento menor');
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 96);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), null::numeric, 'volver a menos de 5 % por debajo de la lista quita el descuento');
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 100);
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 80);
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 120);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), null::numeric, 'subir por encima del precio de lista quita el descuento');
select public.update_variant(current_setting('t.vc')::uuid, '500 g', 'CAFE-500', 80);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), 120::numeric, 'y un nuevo descuento parte del precio vigente (120), no del viejo');
select public.update_variant(current_setting('t.vc')::uuid, 'Bolsa 500 g', 'CAFE-500', 80);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), 120::numeric, 'editar solo el nombre no toca el descuento');

-- Quitar a mano
select throws_ok(format($$select public.remove_variant_discount(%L)$$, current_setting('t.vp')), '22023', null::text, 'una variante sin descuento no tiene nada que quitar');
select lives_ok(format($$select public.remove_variant_discount(%L)$$, current_setting('t.vc')), 'el comercio quita el descuento');
select is((select price || '/' || coalesce(compare_at_price::text, 'nulo') from commerce.product_variants where id = current_setting('t.vc')::uuid), '80.00/nulo', 'queda el precio actual como precio normal');
select public.update_variant(current_setting('t.vc')::uuid, 'Bolsa 500 g', 'CAFE-500', 70);
select is((select compare_at_price from commerce.product_variants where id = current_setting('t.vc')::uuid), 80::numeric, 'después de quitarlo, una nueva baja parte del precio actual');
reset role;

select throws_ok(format($$update commerce.product_variants set compare_at_price = price where id = %L$$, current_setting('t.vc')), '23514', null::text, 'el precio anterior debe ser mayor que el actual');

select tests.authenticate_as((select id from tu where k = 'otro'));
select throws_ok(format($$select public.remove_variant_discount(%L)$$, current_setting('t.vc')), '42501', null::text, 'otro comercio no quita el descuento');
select throws_ok(format($$select public.update_variant(%L, 'x', 'CAFE-500', 1)$$, current_setting('t.vc')), '42501', null::text, 'ni cambia el precio');
reset role;

-- Catálogo público: Café con descuento (70 sobre 80), Jugo con descuento solo en la presentación grande, Pan sin descuento
select tests.authenticate_as((select id from tu where k = 'com'));
select public.update_variant(current_setting('t.vj2')::uuid, 'Grande', 'JUGO-G', 45);
reset role;
select tests.authenticate_as_anon();
select is((select count(*)::int from public.catalog_search_products(p_store => current_setting('t.s')::uuid)), 3, 'sin filtro aparecen los tres productos');
select is((select count(*)::int from public.catalog_search_products(p_store => current_setting('t.s')::uuid, p_discount_only => true)), 2, 'con el filtro solo los que tienen descuento');
select is((select compare_price || '/' || discount_pct from public.catalog_search_products(p_store => current_setting('t.s')::uuid, p_discount_only => true) where name = 'Café'), '80.00/13', 'la tarjeta del café trae su precio anterior y 13 %');
select is((select discount_pct || '/' || coalesce(compare_price::text, 'nulo') from public.catalog_search_products(p_store => current_setting('t.s')::uuid) where name = 'Jugo'), '25/nulo',
  'el jugo muestra el mayor descuento de sus presentaciones, sin precio tachado porque la más barata no está en descuento');
select is((select name from public.catalog_search_products(p_store => current_setting('t.s')::uuid, p_sort => 'descuento') limit 1), 'Jugo', 'el orden por descuento pone primero al de mayor porcentaje');
select is((select discount_pct from public.catalog_search_products(p_store => current_setting('t.s')::uuid) where name = 'Pan'), 0, 'un producto sin descuento tiene 0 %');
select is((public.catalog_product(current_setting('t.pj')::uuid) -> 'variants' -> 1 ->> 'discount_pct')::int, 25, 'la ficha trae el porcentaje de cada presentación');
select is((public.catalog_product(current_setting('t.pj')::uuid) -> 'variants' -> 1 ->> 'compare_at_price')::numeric, 60::numeric, 'y su precio anterior');
reset role;

select ok(exists (select 1 from audit.events where action = 'variant.updated' and after_data -> 'changed_fields' ? 'discount'), 'activar o quitar un descuento queda auditado');
select ok(exists (select 1 from audit.events where action = 'variant.discount_removed'), 'quitarlo a mano también');

select * from finish();
rollback;
