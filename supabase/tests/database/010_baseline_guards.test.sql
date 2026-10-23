begin;
select plan(5);

select is_empty($$
  select schemaname || '.' || tablename from pg_tables
  where schemaname in ('identity', 'audit', 'private', 'commerce', 'public') and not rowsecurity
$$, 'toda tabla de los esquemas del proyecto tiene RLS activo');

select is_empty($$
  select p.oid::regprocedure from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
    and p.proname not in ('catalog_stores', 'catalog_store', 'catalog_categories', 'catalog_products', 'catalog_product', 'quote_cart', 'catalog_search_stores', 'catalog_search_products')
$$, 'anon solo ejecuta las funciones públicas del catálogo (lista explícita)');

select results_eq($$
  -- `name` trae la colación «C»: sin fijarla, comparar con los literales falla («could not determine which collation»).
  select (p.proname::text collate "default") from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1
$$, $$ values ('catalog_categories'), ('catalog_product'), ('catalog_products'), ('catalog_search_products'), ('catalog_search_stores'), ('catalog_store'), ('catalog_stores'), ('quote_cart') $$,
  'la lista pública es exactamente la del catálogo: nada más');

select is_empty($$
  select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')
    and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'insert'))
$$, 'anon no tiene privilegios sobre ninguna tabla ni vista de public');

select is_empty($$
  select p.oid::regprocedure from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'identity', 'audit', 'private', 'commerce') and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
$$, 'toda función SECURITY DEFINER fija search_path');

select * from finish();
rollback;