begin;
select plan(13);

create temp table tu (k text primary key, id uuid);
insert into tu select k, tests.create_user(k || '-730@t.test')
from unnest(array['shop', 'console', 'courier', 'forged', 'invalid']) k;

-- Reproduce Admin API: el perfil se inserta antes de que Auth complete los metadatos del servidor.
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rapitrip_app":"consola"}'::jsonb
where id = (select id from tu where k = 'console');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rapitrip_app":"repartidor"}'::jsonb
where id = (select id from tu where k = 'courier');
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rapitrip_app":"admin"}'::jsonb
where id = (select id from tu where k = 'invalid');
update auth.users set raw_user_meta_data = raw_user_meta_data || '{"rapitrip_app":"consola"}'::jsonb
where id = (select id from tu where k = 'forged');

set constraints auth.on_auth_user_app_finalized immediate;

select is((select app from identity.profiles where id = (select id from tu where k = 'shop')), 'tienda', 'un registro normal pertenece a la tienda');
select ok(exists (select 1 from identity.user_roles where user_id = (select id from tu where k = 'shop') and role = 'cliente'), 'el cliente conserva su rol');
select is((select app from identity.profiles where id = (select id from tu where k = 'console')), 'consola', 'la cuenta administrativa lee los metadatos completos del alta');
select ok(not exists (select 1 from identity.user_roles where user_id = (select id from tu where k = 'console') and role = 'cliente'), 'la consola no conserva un rol de cliente');
select is((select app from identity.profiles where id = (select id from tu where k = 'courier')), 'repartidor', 'también se finaliza la cuenta del repartidor');
select ok(not exists (select 1 from identity.user_roles where user_id = (select id from tu where k = 'courier') and role = 'cliente'), 'el repartidor no conserva un rol de cliente');
select is((select app from identity.profiles where id = (select id from tu where k = 'forged')), 'tienda', 'user_metadata no permite elegir la app');
select is((select app from identity.profiles where id = (select id from tu where k = 'invalid')), 'tienda', 'una marca de servidor inválida no concede otra app');
select lives_ok(format('select public.bootstrap_superadmin(%L)', (select id from tu where k = 'console')), 'la cuenta de consola ya puede recibir su rol por el servidor');

-- La finalización solo ocurre en el alta, nunca al actualizar una cuenta que ya fue finalizada.
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rapitrip_app":"consola"}'::jsonb
where id = (select id from tu where k = 'shop');
select is((select app from identity.profiles where id = (select id from tu where k = 'shop')), 'tienda', 'cambiar metadatos posteriormente no cambia la app');
select throws_ok(format('update identity.profiles set app = ''consola'' where id = %L', (select id from tu where k = 'shop')), '42501', null::text, 'la protección de app sigue activa después de finalizar el alta');
select ok(not has_function_privilege('authenticated', 'private.finalize_new_account_app()', 'execute'), 'una sesión no ejecuta el inicializador');
select ok(not has_function_privilege('anon', 'private.finalize_new_account_app()', 'execute'), 'anon tampoco ejecuta el inicializador');

select * from finish();
rollback;
