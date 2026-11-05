-- Zero Trust: cada cuenta es de una sola app (tienda, consola o repartidor) y nunca se cruza con otra.
begin;
select plan(20);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli', tests.create_user('cli630@t.test');
insert into tu select 'sup', tests.create_user('sup630@t.test');
insert into tu select 'adm', tests.create_user('adm630@t.test');
select tests.grant_role((select id from tu where k = 'sup'), 'superadmin');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
delete from identity.institutional_domains;
insert into identity.institutional_domains (domain) values ('equipo630.test');

-- El alta: sin marca del servidor la cuenta es de la tienda; con marca, de su app y sin el rol de cliente.
select is((select app from identity.profiles where id = (select id from tu where k = 'cli')), 'tienda',
  'una cuenta que se registra sola es de la tienda');
select ok(exists (select 1 from identity.user_roles where user_id = (select id from tu where k = 'cli') and role = 'cliente' and status = 'activo'),
  'y recibe el rol de cliente');
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'nueva630@equipo630.test', now(),
        '{"provider":"email","rapitrip_app":"consola"}'::jsonb, '{}'::jsonb, now(), now(), '', '', '', '');
select is((select p.app from identity.profiles p join identity.profile_pii pii on pii.user_id = p.id where pii.email = 'nueva630@equipo630.test'),
  'consola', 'una cuenta creada por el servidor para la consola es de la consola');
select ok(not exists (select 1 from identity.user_roles ur join identity.profile_pii pii on pii.user_id = ur.user_id
                      where pii.email = 'nueva630@equipo630.test'),
  'y no recibe el rol de cliente');

-- Los roles no se cruzan entre apps.
select throws_ok(format($$insert into identity.user_roles (user_id, role) values (%L, 'cajero')$$, (select id from tu where k = 'cli')),
  '42501', null::text, 'una cuenta de la tienda no puede tener un rol de consola');
select throws_ok(format($$insert into identity.user_roles (user_id, role) values (%L, 'repartidor')$$, (select id from tu where k = 'cli')),
  '42501', null::text, 'ni el de repartidor');
select throws_ok(format($$insert into identity.user_roles (user_id, role) values (%L, 'cliente')$$, (select id from tu where k = 'adm')),
  '42501', null::text, 'una cuenta de consola no puede tener el rol de cliente');
select throws_ok(format($$update identity.profiles set app = 'consola' where id = %L$$, (select id from tu where k = 'cli')),
  '42501', null::text, 'la app de una cuenta no se cambia');
select ok(has_column_privilege('authenticated', 'identity.profiles', 'app', 'select')
          and not has_column_privilege('authenticated', 'identity.profiles', 'app', 'update'),
  'cada uno lee la app de su cuenta, pero no la cambia');

-- Invitar al equipo: solo correos institucionales y nunca una cuenta de otra app.
select tests.authenticate_as((select id from tu where k = 'sup'));
select throws_ok($$select public.create_invitation('ana@gmail.com', 'cajero', repeat('a', 64))$$, '22023', null::text,
  'el equipo no se invita con un correo personal');
select throws_ok($$select public.create_invitation('cli630@t.test', 'cajero', repeat('a', 64))$$, '22023', null::text,
  'tampoco con el correo de una cuenta de la tienda fuera del dominio');
select ok((public.create_invitation('caja630@equipo630.test', 'cajero', repeat('a', 64)) ->> 'id') is not null,
  'con un correo institucional sí se invita');
reset role;

-- Aceptar con una cuenta de otra app no funciona.
update identity.profile_pii set email = 'tienda630@equipo630.test' where user_id = (select id from tu where k = 'cli');
select tests.authenticate_as((select id from tu where k = 'sup'));
select throws_ok($$select public.create_invitation('tienda630@equipo630.test', 'cajero', repeat('b', 64))$$, '23505', null::text,
  'el correo institucional de una cuenta de la tienda no se invita');
reset role;
insert into identity.invitations (email, role, invited_by, token_hash, expires_at)
values ('tienda630@equipo630.test', 'coordinador', (select id from tu where k = 'sup'), repeat('c', 64), now() + interval '1 day');
select set_config('role', 'service_role', true);
select is(public.finish_accept_invitation(repeat('c', 64), (select id from tu where k = 'cli')), false,
  'una cuenta de la tienda no acepta una invitación de la consola');
select is(public.lookup_auth_user('cli630@t.test') ->> 'app', 'tienda', 'la búsqueda de la invitación dice de qué app es la cuenta');
reset role;

-- Los dominios institucionales los maneja solo la dirección.
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select public.add_institutional_domain('otro.test')$$, '42501', null::text, 'la administración no agrega dominios');
select is((select count(*)::int from public.list_institutional_domains()), 1, 'pero sí ve la lista');
reset role;
select tests.authenticate_as((select id from tu where k = 'sup'));
select lives_ok($$select public.add_institutional_domain('@Rapitrip.COM ')$$, 'la dirección agrega un dominio');
select is((select string_agg(domain, ',' order by domain) from public.list_institutional_domains()), 'equipo630.test,rapitrip.com',
  'el dominio se guarda limpio y en minúsculas');
reset role;

-- El primer superadmin solo se siembra sobre una cuenta de consola.
select set_config('role', 'service_role', true);
select throws_ok(format($$select public.bootstrap_superadmin(%L)$$, (select id from tu where k = 'cli')), '42501', null::text,
  'una cuenta de la tienda no puede ser superadmin');
reset role;

select * from finish();
rollback;
