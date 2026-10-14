begin;
select plan(11);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');

select tests.set_claims((select id from tu where k = 'adm'));
select lives_ok($$select private.write_audit('test.action', 'thing', '1')$$, 'write_audit inserta');
select is((select actor_role::text from audit.events where action = 'test.action'), 'admin',
  'guarda el rol de mayor jerarquía del actor');
select is((select actor_id from audit.events where action = 'test.action'), (select id from tu where k = 'adm'),
  'guarda el actor tomado de auth.uid()');

select throws_ok($$update audit.events set action = 'x'$$, '42501', null::text, 'UPDATE bloqueado');
select throws_ok($$delete from audit.events$$, '42501', null::text, 'DELETE bloqueado');
select throws_ok($$truncate audit.events$$, '42501', null::text, 'TRUNCATE bloqueado');

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$insert into audit.events (action) values ('x')$$, '42501', null::text,
  'authenticated no inserta directo');
reset role;

select set_config('role', 'service_role', true);
select throws_ok($$insert into audit.events (action) values ('x')$$, '42501', null::text,
  'service_role no inserta directo');
reset role;

select tests.authenticate_as_anon();
select throws_ok($$select * from audit.events$$, '42501', null::text, 'anon no lee la auditoría');
reset role;

select throws_ok($$select private.write_audit('x', null, null, '{"email":"a@b.c"}'::jsonb)$$,
  '22023', null::text, 'se rechazan claves de datos personales');
select lives_ok($$select private.write_audit('x.fields', null, null, null, '{"changed_fields":["full_name"]}'::jsonb)$$,
  'un nombre de campo como valor no es un dato personal');

select * from finish();
rollback;