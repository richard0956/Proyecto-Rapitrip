begin;
select plan(5);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'sus', tests.create_user('sus@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'sus'), 'cajero');
update identity.user_roles set status = 'suspendido'
  where user_id = (select id from tu where k = 'sus') and role = 'cajero';

select ok(
  (private.custom_access_token_hook(jsonb_build_object('user_id', (select id from tu where k = 'adm'), 'claims', '{}'::jsonb))
    -> 'claims' -> 'app_roles') @> '[{"role":"admin"}]'::jsonb,
  'el hook agrega los roles activos');
select ok(
  not ((private.custom_access_token_hook(jsonb_build_object('user_id', (select id from tu where k = 'sus'), 'claims', '{}'::jsonb))
    -> 'claims' -> 'app_roles') @> '[{"role":"cajero"}]'::jsonb),
  'el hook omite los roles suspendidos');

select tests.authenticate_as_anon();
select throws_ok($$select private.custom_access_token_hook('{}'::jsonb)$$, '42501', null::text,
  'solo supabase_auth_admin ejecuta el hook');
reset role;

-- Foco de revisión 1: un token con roles viejos no concede nada.
select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('request.jwt.claims',
  (current_setting('request.jwt.claims')::jsonb || '{"app_roles":[{"role":"admin"}]}'::jsonb)::text, true);
select is((select count(*) from public.accounts_staff), 0::bigint,
  'una claim app_roles que dice admin no abre la lista de cuentas');
select throws_ok(format($$select public.suspend_role(%L, 'cajero', 'intento con token viejo')$$, (select id from tu where k = 'sus')),
  '42501', null::text, 'una claim app_roles que dice admin no permite gestionar roles');
reset role;

select * from finish();
rollback;