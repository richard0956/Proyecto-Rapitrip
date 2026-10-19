begin;
select plan(31);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

-- Catálogo maestro (lo crea administración).
select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.cat', public.create_master_item('categoria', 'Bebidas')::text, true);
select set_config('t.catoff', public.create_master_item('categoria', 'Vacía')::text, true);
reset role;

-- Comercio A: tienda abierta todo el día con envío de 25, cuatro productos y una tienda extra inactiva.
select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select public.set_store_hours(current_setting('t.store')::uuid,
  (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
select public.set_store_delivery_fee(current_setting('t.store')::uuid, 25);
select set_config('t.store2', public.create_store((select id from tc where k = 'a'), 'Tienda cerrada por horario')::text, true);

select set_config('t.cafe', public.create_product(current_setting('t.store')::uuid, 'Café molido', 'Del bueno', current_setting('t.cat')::uuid)::text, true);
select set_config('t.cafe_v', public.create_variant(current_setting('t.cafe')::uuid, '500 g', 'CAFE-500', 100)::text, true);
select set_config('t.cafe_v2', public.create_variant(current_setting('t.cafe')::uuid, '1 kg', 'CAFE-1000', 180)::text, true);
select set_config('t.pan', public.create_product(current_setting('t.store')::uuid, 'Pan 100% integral')::text, true);
select set_config('t.pan_v', public.create_variant(current_setting('t.pan')::uuid, 'unidad', 'PAN-1', 10.5)::text, true);
select set_config('t.agot', public.create_product(current_setting('t.store')::uuid, 'Agotado')::text, true);
select set_config('t.agot_v', public.create_variant(current_setting('t.agot')::uuid, 'unidad', 'AGO-1', 5)::text, true);
select set_config('t.borr', public.create_product(current_setting('t.store')::uuid, 'Borrador secreto')::text, true);
select set_config('t.borr_v', public.create_variant(current_setting('t.borr')::uuid, 'unidad', 'BOR-1', 5)::text, true);
select public.set_product_status(current_setting('t.cafe')::uuid, 'publicado');
select public.set_product_status(current_setting('t.pan')::uuid, 'publicado');
select public.set_product_status(current_setting('t.agot')::uuid, 'publicado');
select public.set_stock_tracking(current_setting('t.cafe_v')::uuid, true, 2);
select public.add_stock(current_setting('t.cafe_v')::uuid, 7, 'compra inicial');
select public.set_stock_tracking(current_setting('t.agot_v')::uuid, true, 2);
select public.add_product_image(current_setting('t.cafe')::uuid,
  current_setting('t.store') || '/' || current_setting('t.cafe') || '/portada.jpg');
reset role;

-- Comercio B: tienda con un producto publicado, para suspenderla después.
insert into commerce.stores (commerce_id, name) values ((select id from tc where k = 'b'), 'Tienda B');
insert into commerce.products (store_id, name, status)
  select id, 'Producto de B', 'publicado' from commerce.stores where name = 'Tienda B';
insert into commerce.product_variants (product_id, store_id, name, sku, price)
  select p.id, p.store_id, 'unidad', 'B-1', 9 from commerce.products p where p.name = 'Producto de B';

-- Visitante sin sesión ----------------------------------------------------------------------------------------------
select tests.authenticate_as_anon();

select is((select count(*)::int from public.catalog_stores()), 3, 'el visitante ve las tiendas activas de comercios activos (A, la sin horario y B)');
select is((select name from public.catalog_stores(false) where id = current_setting('t.store')::uuid), 'Tienda A', 'incluye la tienda de A');
select is((select delivery_fee from public.catalog_stores() where id = current_setting('t.store')::uuid), 25.00::numeric, 'muestra el costo de envío');
select ok((select open_now from public.catalog_stores() where id = current_setting('t.store')::uuid), 'la tienda con horario de todo el día está abierta');
select is((select count(*)::int from public.catalog_stores(true)), 1, 'el filtro "abiertas ahora" oculta las que no tienen horario');
select is((select count(*)::int from public.catalog_stores(false, 1, 0)), 1, 'la paginación respeta el límite');
select is((select count(*)::int from public.catalog_stores(false, 100000, 0)), 3, 'el límite se topa (nunca vuelca todo el catálogo)');
select is((select product_count from public.catalog_stores() where id = current_setting('t.store')::uuid), 2,
  'cuenta solo productos publicados y disponibles (café y pan; el agotado y el borrador no)');

select is((select count(*)::int from public.catalog_products(current_setting('t.store')::uuid)), 2,
  'la lista de la tienda muestra café y pan; oculta el agotado y el borrador');
select is((select count(*)::int from public.catalog_products(current_setting('t.store')::uuid, null, 'borrador')), 0, 'buscar un borrador no lo revela');
select is((select count(*)::int from public.catalog_products(current_setting('t.store')::uuid, null, 'CAF')), 1, 'la búsqueda ignora mayúsculas');
select is((select count(*)::int from public.catalog_products(current_setting('t.store')::uuid, null, '100%')), 1, 'el % del texto se toma literal');
select is((select count(*)::int from public.catalog_products(current_setting('t.store')::uuid, null, '%')), 1, 'un % suelto no es comodín (solo el pan lo contiene)');
select is((select count(*)::int from public.catalog_products(current_setting('t.store')::uuid, current_setting('t.cat')::uuid)), 1, 'filtra por categoría');
select is((select min_price from public.catalog_products(current_setting('t.store')::uuid, null, 'café')), 100.00::numeric, 'precio mínimo entre variantes disponibles');
select is((select cover_path from public.catalog_products(current_setting('t.store')::uuid, null, 'café')),
  current_setting('t.store') || '/' || current_setting('t.cafe') || '/portada.jpg', 'devuelve la imagen de portada');

select is((select count(*)::int from public.catalog_categories(current_setting('t.store')::uuid)), 1, 'solo categorías con productos visibles');

select is((public.catalog_product(current_setting('t.cafe')::uuid) -> 'variants' -> 0 ->> 'name'), '500 g', 'la ficha lista las variantes por precio');
select ok(not (public.catalog_product(current_setting('t.cafe')::uuid)::text like '%sku%' or public.catalog_product(current_setting('t.cafe')::uuid)::text like '%CAFE-500%'),
  'la ficha nunca incluye SKU');
select is((public.catalog_product(current_setting('t.cafe')::uuid) -> 'variants' -> 0 ->> 'max_per_order')::int, 7, 'con control de stock, el máximo comprable');
select is(public.catalog_product(current_setting('t.borr')::uuid), null::jsonb, 'un borrador no tiene ficha pública');
select is((public.catalog_product(current_setting('t.agot')::uuid) -> 'variants' -> 0 ->> 'available')::boolean, false, 'la ficha muestra la variante agotada como no disponible');

-- quote_cart
select is((public.quote_cart(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":2}]', current_setting('t.cafe_v'))::jsonb) ->> 'total')::numeric, 225.00::numeric,
  'cotiza 2 x 100 + 25 de envío sin sesión');
select is(jsonb_array_length(public.quote_cart(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":50}]', current_setting('t.cafe_v'))::jsonb) -> 'problems'), 1, 'avisa cuando pide más de lo que hay');
select is((public.quote_cart(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1,"seen_price":90}]', current_setting('t.pan_v'))::jsonb) -> 'problems' -> 0 ->> 'code'), 'precio_cambiado',
  'avisa cuando el precio visto ya no es el vigente');
select is((public.quote_cart(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.borr_v'))::jsonb) -> 'problems' -> 0 ->> 'code'), 'producto_no_disponible',
  'un borrador no se cotiza');
select throws_ok(format($$select public.quote_cart(%L, '[]'::jsonb)$$, current_setting('t.store')), '22023', null::text, 'un carrito vacío se rechaza');
reset role;

-- Cierre temporal: la tienda se sigue viendo, pero cerrada y con el motivo (D6).
select tests.authenticate_as((select id from tu where k = 'com'));
select public.close_store_temporarily(current_setting('t.store')::uuid, now() + interval '2 hours', 'Inventario');
reset role;
select tests.authenticate_as_anon();
select is((public.catalog_store(current_setting('t.store')::uuid) ->> 'open_now')::boolean, false, 'con cierre temporal la tienda aparece cerrada');
select is((public.catalog_store(current_setting('t.store')::uuid) ->> 'closed_reason'), 'Inventario', 'y muestra el motivo');
select ok((public.quote_cart(current_setting('t.store')::uuid,
  format('[{"variant_id":"%s","quantity":1}]', current_setting('t.pan_v'))::jsonb) -> 'problems')::text like '%tienda_cerrada%', 'cotizar avisa que la tienda está cerrada');
reset role;

-- Comercio suspendido: nada de B es público.
select tests.authenticate_as((select id from tu where k = 'adm'));
select public.set_commerce_status((select id from tc where k = 'b'), 'suspendido', 'incumplimiento del convenio');
reset role;
select tests.authenticate_as_anon();
select is((select count(*)::int from public.catalog_stores() where name = 'Tienda B'), 0, 'un comercio suspendido desaparece del catálogo');
reset role;

select * from finish();
rollback;
