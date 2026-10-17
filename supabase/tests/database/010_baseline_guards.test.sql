begin;
select plan(4);

select is_empty($$
  select schemaname || '.' || tablename from pg_tables
  where schemaname in ('identity', 'audit', 'private', 'commerce', 'public') and not rowsecurity
$$, 'toda tabla de los esquemas del proyecto tiene RLS activo');

select is_empty($$
  select p.oid::regprocedure from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no puede ejecutar ninguna función de public');

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