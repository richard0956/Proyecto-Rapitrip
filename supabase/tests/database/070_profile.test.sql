begin;
select plan(6);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli', tests.create_user('cli@t.test', 'Nombre Viejo');

select tests.authenticate_as((select id from tu where k = 'cli'), 'aal1');
select lives_ok($$select public.update_my_profile('Nombre Nuevo', '88881234')$$, 'el cliente edita su perfil');
select throws_ok($$select public.update_my_profile('A', '88881234')$$, '22023', null::text, 'nombre demasiado corto');
select throws_ok($$select public.update_my_profile('Nombre Nuevo', 'abc')$$, '22023', null::text, 'teléfono inválido');
reset role;

select is((select full_name || '|' || phone from identity.profile_pii where user_id = (select id from tu where k = 'cli')),
  'Nombre Nuevo|88881234', 'se guardan los cambios');
select ok((select after_data -> 'changed_fields' @> '["full_name","phone"]'::jsonb
              and after_data::text not like '%88881234%' and after_data::text not like '%Nombre Nuevo%'
           from audit.events where action = 'profile.updated'),
  'la auditoría guarda los nombres de campo y ningún valor personal');

select tests.authenticate_as_anon();
select throws_ok($$select public.update_my_profile('Nombre Nuevo', '88881234')$$, '42501', null::text,
  'anon no puede editar perfiles');
reset role;

select * from finish();
rollback;