begin;
select plan(15);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test', 'Cliente Visible');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');

select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok($$select set_config('t.courier', public.create_courier('Rep Uno', '88887777', 'moto', 'docs/rep1.pdf')::text, true)$$,
  'el admin crea la ficha de un repartidor');
reset role;

select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok($$select public.create_courier('Rep Dos', '88886666', 'moto')$$, '42501', null::text,
  'el cajero no crea repartidores');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select document_path from identity.couriers$$, '42501', null::text,
  'document_path no se selecciona directamente');
select is(public.read_courier_document(current_setting('t.courier')::uuid), 'docs/rep1.pdf',
  'la RPC devuelve la ruta del documento');
reset role;
select ok(exists (select 1 from audit.events where action = 'read_sensitive'
  and actor_id = (select id from tu where k = 'adm') and metadata ->> 'resource' = 'courier_document'),
  'la lectura del documento queda auditada');

select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.read_courier_document(%L)$$, current_setting('t.courier')),
  '42501', null::text, 'el coordinador no lee documentos');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok($$select set_config('t.courier2', public.create_courier('Rep Sin Doc', '88885555', 'bicicleta')::text, true)$$,
  'se crea un repartidor sin documento');
select throws_ok(format($$select public.read_courier_document(%L)$$, current_setting('t.courier2')),
  'P0002', null::text, 'sin documento no hay nada que leer');
select lives_ok(format($$select public.update_courier(%L, 'Rep Uno', '99999999', 'moto')$$, current_setting('t.courier')),
  'el admin actualiza al repartidor');
reset role;
select ok((select after_data -> 'changed_fields' @> '["phone"]'::jsonb and after_data::text not like '%99999999%'
           from audit.events where action = 'courier.updated'),
  'la auditoría guarda el campo cambiado y no el teléfono');

select tests.authenticate_as((select id from tu where k = 'adm'));
select lives_ok(format($$select public.set_courier_status(%L, 'inactivo', 'ya no trabaja con nosotros')$$, current_setting('t.courier')),
  'el admin desactiva al repartidor');
select is(public.get_client_detail((select id from tu where k = 'cli')) ->> 'email', 'cli@t.test',
  'el admin consulta el detalle de un cliente');
reset role;
select ok(exists (select 1 from audit.events where action = 'read_sensitive' and metadata ->> 'resource' = 'client_detail'),
  'la consulta del detalle queda auditada');

select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok(format($$select public.get_client_detail(%L)$$, (select id from tu where k = 'cli')),
  '42501', null::text, 'el coordinador no consulta datos personales de clientes');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok($$select public.create_courier('Rep Malo', 'abc', 'moto')$$, '22023', null::text,
  'el teléfono se valida');
reset role;

select * from finish();
rollback;