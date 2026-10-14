begin;
select plan(65);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli1', tests.create_user('cli1@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
insert into tu select 'com',  tests.create_user('com@t.test');
insert into tu select 'caj',  tests.create_user('caj@t.test');
insert into tu select 'coo',  tests.create_user('coo@t.test');
insert into tu select 'adm',  tests.create_user('adm@t.test');
insert into tu select 'sup',  tests.create_user('sup@t.test');

select tests.grant_role((select id from tu where k = 'com'), 'comercio', tests.create_commerce('C1'));
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'sup'), 'superadmin');

insert into identity.couriers (full_name, phone, vehicle_type) values ('Rep Uno', '88888888', 'moto');
insert into identity.commerce_requests (requester_id, business_name)
  values ((select id from tu where k = 'cli2'), 'Negocio');
insert into audit.it_incidents (type, origin, severity, description)
  values ('seguridad', 'manual', 'baja', 'incidente de prueba');
insert into identity.invitations (email, role, invited_by, token_hash, expires_at)
  values ('nuevo@t.test', 'cajero', (select id from tu where k = 'adm'), repeat('a', 64), now() + interval '4 days');

-- (usuario, relación, nivel de sesión, filas visibles esperadas). -1 = sin privilegio.
select is(
  case when r.k = 'anon' then tests.count_as_anon(r.rel)
       else tests.count_as((select id from tu where k = r.k), r.rel, r.aal) end,
  r.expected::bigint,
  r.k || ' (' || r.aal || ') -> ' || r.rel
)
from (values
  ('cli1','public.my_profile','aal2',1), ('cli2','public.my_profile','aal2',1), ('com','public.my_profile','aal2',1),
  ('caj','public.my_profile','aal2',1),  ('coo','public.my_profile','aal2',1),  ('adm','public.my_profile','aal2',1),
  ('sup','public.my_profile','aal2',1),

  ('cli1','public.my_roles','aal2',1), ('cli2','public.my_roles','aal2',1), ('com','public.my_roles','aal2',2),
  ('caj','public.my_roles','aal2',2),  ('coo','public.my_roles','aal2',2),  ('adm','public.my_roles','aal2',2),
  ('sup','public.my_roles','aal2',2),

  ('cli1','public.accounts_staff','aal2',0), ('cli2','public.accounts_staff','aal2',0),
  ('com','public.accounts_staff','aal2',1),  ('caj','public.accounts_staff','aal2',1),
  ('coo','public.accounts_staff','aal2',1),  ('adm','public.accounts_staff','aal2',5),
  ('sup','public.accounts_staff','aal2',5),  ('adm','public.accounts_staff','aal1',1),

  ('cli1','public.couriers_list','aal2',0), ('com','public.couriers_list','aal2',0),
  ('caj','public.couriers_list','aal2',1),  ('coo','public.couriers_list','aal2',1),
  ('adm','public.couriers_list','aal2',1),  ('sup','public.couriers_list','aal2',1),
  ('adm','public.couriers_list','aal1',0),

  ('cli1','public.commerce_requests_list','aal2',0), ('cli2','public.commerce_requests_list','aal2',1),
  ('com','public.commerce_requests_list','aal2',0),  ('caj','public.commerce_requests_list','aal2',0),
  ('coo','public.commerce_requests_list','aal2',0),  ('adm','public.commerce_requests_list','aal2',1),
  ('sup','public.commerce_requests_list','aal2',1),  ('adm','public.commerce_requests_list','aal1',0),

  ('cli1','public.it_incidents_list','aal2',0), ('com','public.it_incidents_list','aal2',0),
  ('caj','public.it_incidents_list','aal2',0),  ('coo','public.it_incidents_list','aal2',0),
  ('adm','public.it_incidents_list','aal2',1),  ('sup','public.it_incidents_list','aal2',1),
  ('adm','public.it_incidents_list','aal1',0),

  ('cli1','public.invitations_list','aal2',0), ('com','public.invitations_list','aal2',0),
  ('caj','public.invitations_list','aal2',0),  ('coo','public.invitations_list','aal2',0),
  ('adm','public.invitations_list','aal2',1),  ('sup','public.invitations_list','aal2',1),
  ('adm','public.invitations_list','aal1',0),

  ('cli1','audit.events','aal2',-1), ('adm','audit.events','aal2',-1), ('sup','audit.events','aal2',-1),

  ('cli1','identity.profile_pii','aal2',1), ('com','identity.profile_pii','aal2',1),
  ('caj','identity.profile_pii','aal2',1),  ('adm','identity.profile_pii','aal2',5),
  ('adm','identity.profile_pii','aal1',1),

  ('anon','public.my_profile','aal2',-1), ('anon','public.couriers_list','aal2',-1),
  ('anon','audit.events','aal2',-1),      ('anon','public.accounts_staff','aal2',-1)
) as r(k, rel, aal, expected);

-- Columnas sensibles nunca seleccionables
select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select document_path from identity.couriers$$, '42501', null::text,
  'ni el admin puede seleccionar document_path directamente');
select throws_ok($$select token_hash from identity.invitations$$, '42501', null::text,
  'ni el admin puede seleccionar token_hash');
reset role;

select * from finish();
rollback;