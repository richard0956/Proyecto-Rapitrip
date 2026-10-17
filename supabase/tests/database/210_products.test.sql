begin;
select plan(27);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'com', tests.create_user('com@t.test');
insert into tu select 'otro', tests.create_user('otro@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio A');
insert into tc select 'b', tests.create_commerce('Comercio B');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));
select tests.grant_role((select id from tu where k = 'otro'), 'comercio', (select id from tc where k = 'b'));

-- Datos base creados como la administración
select tests.authenticate_as((select id from tu where k = 'adm'));
select set_config('t.store', public.create_store((select id from tc where k = 'a'), 'Tienda A')::text, true);
select set_config('t.storeb', public.create_store((select id from tc where k = 'b'), 'Tienda B')::text, true);
select set_config('t.cat', public.create_master_item('categoria', 'Bebidas')::text, true);
select set_config('t.catoff', public.create_master_item('categoria', 'Obsoleta')::text, true);
select public.set_master_item_status(current_setting('t.catoff')::uuid, 'inactivo', 'ya no se usa');
reset role;

select tests.authenticate_as((select id from tu where k = 'com'));
select lives_ok(format($$select set_config('t.prod', public.create_product(%L, 'Café molido', 'Tueste medio', %L)::text, true)$$,
  current_setting('t.store'), current_setting('t.cat')), 'el comercio crea un producto con categoría');
select lives_ok(format($$select set_config('t.free', public.create_product(%L, 'Sin clasificar')::text, true)$$, current_setting('t.store')),
  'el catálogo maestro es opcional');
select throws_ok(format($$select public.create_product(%L, 'Café molido')$$, current_setting('t.store')), '23505', null::text,
  'el nombre no se repite en la tienda');
select throws_ok(format($$select public.create_product(%L, 'Raro', null, %L)$$, current_setting('t.store'), current_setting('t.catoff')),
  '22023', null::text, 'no admite categorías inactivas');
select throws_ok(format($$select public.create_product(%L, 'Ajeno')$$, current_setting('t.storeb')), '42501', null::text,
  'no crea productos en tiendas de otro comercio');
select throws_ok(format($$select public.set_product_status(%L, 'publicado')$$, current_setting('t.prod')), '22023', null::text,
  'no publica sin variantes activas');

-- Variantes
select lives_ok(format($$select set_config('t.var', public.create_variant(%L, 'Bolsa 500 g', 'CAFE-500', 4500.50)::text, true)$$, current_setting('t.prod')),
  'crea una variante con precio y SKU');
select throws_ok(format($$select public.create_variant(%L, 'Bolsa 1 kg', 'cafe-500', 8000)$$, current_setting('t.prod')), '23505', null::text,
  'el SKU no se repite en la tienda (sin distinguir mayúsculas)');
select throws_ok(format($$select public.create_variant(%L, 'Mala', 'X', 10)$$, current_setting('t.prod')), '22023', null::text, 'valida el SKU');
select throws_ok(format($$select public.create_variant(%L, 'Negativa', 'NEG-1', -5)$$, current_setting('t.prod')), '22023', null::text, 'valida el precio');
select lives_ok(format($$select public.update_variant(%L, 'Bolsa 500 g', 'CAFE-500', 4700)$$, current_setting('t.var')), 'actualiza el precio');
select is((select price from public.product_variants_list where id = current_setting('t.var')::uuid), 4700.00::numeric, 'el precio se guardó');

-- Publicación
select lives_ok(format($$select public.set_product_status(%L, 'publicado')$$, current_setting('t.prod')), 'publica con una variante activa');
select throws_ok(format($$select public.set_variant_status(%L, 'inactiva')$$, current_setting('t.var')), '22023', null::text,
  'no desactiva la última variante de un producto publicado');
select is((select min_price from public.products_list where id = current_setting('t.prod')::uuid), 4700.00::numeric, 'la lista muestra el precio mínimo');

-- Imágenes
select lives_ok(format($$select public.add_product_image(%L, %L)$$, current_setting('t.prod'),
  current_setting('t.store') || '/' || current_setting('t.prod') || '/portada.webp'), 'registra una imagen');
select throws_ok(format($$select public.add_product_image(%L, %L)$$, current_setting('t.prod'),
  current_setting('t.storeb') || '/' || current_setting('t.prod') || '/ajena.webp'), '22023', null::text, 'rechaza rutas de otra tienda');
select is((select cover_path from public.products_list where id = current_setting('t.prod')::uuid),
  current_setting('t.store') || '/' || current_setting('t.prod') || '/portada.webp', 'la primera imagen es la portada');
select ok(public.remove_product_image((select id from public.product_images_list where product_id = current_setting('t.prod')::uuid limit 1)) is not null,
  'quita la imagen y devuelve su ruta');
reset role;

-- Aislamiento y permisos
select tests.authenticate_as((select id from tu where k = 'otro'));
select is((select count(*)::int from public.products_list), 0, 'otro comercio no ve productos ajenos');
select throws_ok(format($$select public.update_variant(%L, 'X', 'ROBADO-1', 1)$$, current_setting('t.var')), '42501', null::text,
  'otro comercio no edita variantes ajenas');
reset role;
select is(tests.count_as((select id from tu where k = 'adm'), 'public.products_list'), 2::bigint, 'la administración ve todos los productos');
select is(tests.count_as((select id from tu where k = 'caj'), 'public.products_list'), 0::bigint, 'el cajero no ve la gestión de productos');

-- Archivado
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok(format($$select public.set_product_status(%L, 'archivado')$$, current_setting('t.prod')), '22023', null::text, 'archivar exige motivo');
select lives_ok(format($$select public.set_product_status(%L, 'archivado', 'descontinuado')$$, current_setting('t.prod')), 'archiva con motivo');
select throws_ok(format($$select public.update_product(%L, 'Nuevo nombre')$$, current_setting('t.prod')), '22023', null::text, 'un archivado no se edita');
reset role;
select ok(exists (select 1 from audit.events where action = 'variant.updated' and after_data -> 'changed_fields' @> '["price"]'::jsonb),
  'la auditoría guarda el campo cambiado y no el valor');

select * from finish();
rollback;
