-- Controles del catálogo (Política 8 del manual de políticas de TI; migración 20261101000090).
begin;
select plan(19);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select k, tests.create_user(k || '660@t.test') from unnest(array['adm', 'coo', 'com', 'cli', 'caj']) k;
create temp table tc (k text primary key, id uuid);
grant select on tc to public;
insert into tc select 'a', tests.create_commerce('Comercio 660');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', (select id from tc where k = 'a'));

select tests.authenticate_as((select id from tu where k = 'com'));
select set_config('t.s', public.create_store((select id from tc where k = 'a'), 'Tienda 660')::text, true);
select set_config('t.p', public.create_product(current_setting('t.s')::uuid, 'Café 660')::text, true);
select public.create_variant(current_setting('t.p')::uuid, '500 g', 'CAFE-660', 150);
select public.set_product_status(current_setting('t.p')::uuid, 'publicado');
reset role;

-- Norma 8.2: el cliente reporta desde la tienda.
select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
select throws_ok(format($$select public.report_catalog_issue(%L, 'precio', 'corto')$$, current_setting('t.p')), '22023', null::text,
  'el reporte necesita una descripción');
select ok(public.report_catalog_issue(current_setting('t.p')::uuid, 'precio', 'En la tienda física cuesta 120, no 150') is not null,
  'un cliente reporta una inconsistencia');
reset role;
select tests.authenticate_as((select id from tu where k = 'com'));
select throws_ok(format($$select public.report_catalog_issue(%L, 'precio', 'Me reporto a mí mismo el precio')$$, current_setting('t.p')), '42501', null::text,
  'el comercio no se reporta a sí mismo');
reset role;

-- Coordinación lo revisa y lo confirma; el comercio recibe el aviso con 24 horas para corregir.
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select status from public.catalog_reports_for_ops() where product_name = 'Café 660'), 'recibido', 'coordinación ve el reporte recibido');
select lives_ok(format($$select public.review_catalog_report(%L, true, 'El precio publicado no coincide con el de la tienda')$$,
  (select id from public.catalog_reports_for_ops() where product_name = 'Café 660')), 'coordinación confirma la inconsistencia');
select ok((select fix_due_at between now() + interval '23 hours' and now() + interval '24 hours 1 minute' from public.catalog_reports_for_ops() where product_name = 'Café 660'),
  'el comercio tiene 24 horas para corregir');
reset role;
select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok($$select * from public.catalog_reports_for_ops()$$, '42501', null::text, 'caja no revisa reportes del catálogo');
reset role;

select tests.authenticate_as((select id from tu where k = 'com'));
select is((select kind || ':' || report_status from public.my_catalog_notices() limit 1), 'inconsistencia:confirmado', 'el comercio ve el aviso');
select lives_ok(format($$select public.mark_catalog_report_fixed(%L, 'Actualicé el precio a 120')$$, (select report_id from public.my_catalog_notices() limit 1)),
  'el comercio marca la corrección');
select throws_ok(format($$select public.mark_catalog_report_fixed(%L, 'Otra vez lo mismo')$$, (select report_id from public.my_catalog_notices() limit 1)), '22023', null::text,
  'una corrección no se registra dos veces');
reset role;

-- Control 8.2.1: con una segunda inconsistencia confirmada, el comercio reincide y la administración decide una medida.
select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
select public.report_catalog_issue(current_setting('t.p')::uuid, 'disponibilidad', 'Dice que hay pero en la tienda está agotado');
reset role;
select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select count(*)::int from public.catalog_recurrences() where commerce_name = 'Comercio 660'), 0, 'con una sola confirmada no hay reincidencia');
select public.review_catalog_report((select id from public.catalog_reports_for_ops() where product_name = 'Café 660' and status = 'recibido'), true, 'Sin stock real en la tienda');
select is((select confirmed from public.catalog_recurrences() where commerce_name = 'Comercio 660'), 2, 'con dos confirmadas, reincide');
select throws_ok(format($$select public.record_catalog_measure(%L, 'no')$$, (select id from tc where k = 'a')), '22023', null::text, 'la medida se describe');
select ok(public.record_catalog_measure((select id from tc where k = 'a'), 'Llamada de advertencia y revisión diaria por una semana') is not null,
  'la administración registra la medida');
select is((select count(*)::int from public.catalog_recurrences() where commerce_name = 'Comercio 660'), 0, 'con la medida registrada deja de estar pendiente');
reset role;
select throws_ok($$update commerce.catalog_measures set measure = 'cambiada después'$$, '42501', null::text, 'una medida registrada no se modifica');

-- Control 8.1.1: revisión semanal de catálogos sin actualizar.
update commerce.products set updated_at = now() - interval '5 days' where store_id = current_setting('t.s')::uuid;
update commerce.product_variants set updated_at = now() - interval '5 days' where store_id = current_setting('t.s')::uuid;
update commerce.inventory set updated_at = now() - interval '5 days' where store_id = current_setting('t.s')::uuid;
update commerce.stock_movements set created_at = now() - interval '5 days' where store_id = current_setting('t.s')::uuid;
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select days from public.stale_catalogs() where name = 'Comercio 660'), 5, 'el comercio aparece con 5 días sin actualizar');
select ok((public.record_catalog_review('Revisión semanal de prueba') ->> 'notified')::int >= 1, 'la revisión semanal avisa a los comercios encontrados');
select is((public.catalog_review_status() ->> 'overdue')::boolean, false, 'recién hecha, la revisión semanal no vence');
reset role;

select * from finish();
rollback;
