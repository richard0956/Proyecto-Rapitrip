begin;
select plan(14);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'u1', tests.create_user('u1@t.test', 'Usuario Uno');
insert into tu select 'u2', tests.create_user('u2@t.test');
insert into tu select 'u3', tests.create_user('u3@t.test');
create temp table tc (k text primary key, id uuid);
insert into tc select 'c1', tests.create_commerce('Comercio 1');
insert into tc select 'c2', tests.create_commerce('Comercio 2');

select ok(exists (select 1 from identity.profiles where id = (select id from tu where k = 'u1')),
  'al crear el usuario se crea su perfil con el mismo id');
select is((select full_name || '|' || email from identity.profile_pii where user_id = (select id from tu where k = 'u1')),
  'Usuario Uno|u1@t.test', 'se copian nombre y correo a profile_pii');
select ok(exists (select 1 from identity.user_roles
  where user_id = (select id from tu where k = 'u1') and role = 'cliente' and status = 'activo'),
  'toda cuenta nueva recibe el rol cliente');

select throws_ok(format($$insert into identity.user_roles (user_id, role) values (%L, 'comercio')$$, (select id from tu where k = 'u1')),
  '23514', null::text, 'el rol comercio exige un comercio');
select throws_ok(format($$insert into identity.user_roles (user_id, role, commerce_id) values (%L, 'cajero', %L)$$,
  (select id from tu where k = 'u1'), (select id from tc where k = 'c1')),
  '23514', null::text, 'un rol distinto de comercio no admite comercio');

select lives_ok(format($$select tests.grant_role(%L, 'comercio', %L)$$, (select id from tu where k = 'u1'), (select id from tc where k = 'c1')),
  'u1 recibe el comercio c1');
select throws_ok(format($$select tests.grant_role(%L, 'comercio', %L)$$, (select id from tu where k = 'u2'), (select id from tc where k = 'c1')),
  '23505', null::text, 'un comercio no puede tener dos cuentas');
select throws_ok(format($$select tests.grant_role(%L, 'comercio', %L)$$, (select id from tu where k = 'u1'), (select id from tc where k = 'c2')),
  '23505', null::text, 'una cuenta no puede tener dos comercios');

select lives_ok(format($$select tests.grant_role(%L, 'cajero')$$, (select id from tu where k = 'u2')), 'u2 recibe cajero');
select throws_ok(format($$select tests.grant_role(%L, 'cajero')$$, (select id from tu where k = 'u2')),
  '23505', null::text, 'no se duplica un rol vigente');
update identity.user_roles set status = 'revocado' where user_id = (select id from tu where k = 'u2') and role = 'cajero';
select lives_ok(format($$select tests.grant_role(%L, 'cajero')$$, (select id from tu where k = 'u2')),
  'tras revocar se puede volver a otorgar');

update auth.users set email = 'nuevo@t.test' where id = (select id from tu where k = 'u1');
select is((select email from identity.profile_pii where user_id = (select id from tu where k = 'u1')),
  'nuevo@t.test', 'el cambio de correo en auth se sincroniza');

delete from auth.users where id = (select id from tu where k = 'u3');
select ok(exists (select 1 from identity.profiles where id = (select id from tu where k = 'u3')),
  'borrar el usuario de auth conserva el perfil (identificador anónimo)');

select tests.authenticate_as_anon();
select throws_ok($$select * from identity.profiles$$, '42501', null::text, 'anon no lee profiles');
reset role;

select * from finish();
rollback;