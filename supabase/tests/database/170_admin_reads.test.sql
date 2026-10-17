begin;
select plan(16);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');

insert into audit.events (action, target_type) values ('test.uno', 'x'), ('test.pag', 'x'), ('test.pag', 'x'), ('test.pag', 'x');
insert into audit.login_events (user_id, occurred_at, result, provider, ip_address, user_agent)
values ((select id from tu where k = 'cli'), now(), 'fallido', 'email', '10.0.0.9', 'agente-de-prueba'),
       ((select id from tu where k = 'cli'), now(), 'exitoso', 'email', '10.0.0.9', 'agente-de-prueba');
select tests.create_commerce('Comercio Lectura');

-- Auditoría
select tests.authenticate_as((select id from tu where k = 'adm'));
select is(public.audit_events_page('test.uno') #>> '{rows,0,action}', 'test.uno', 'el admin filtra eventos por acción');
select ok(not (public.audit_events_page('test.uno') #> '{rows,0}' ? 'device'),
  'la lista no expone el dispositivo');
select is(jsonb_array_length(public.audit_events_page('test.pag', null, null, null, null, 2) -> 'rows'), 2,
  'el límite acota la página');
select is((public.audit_events_page('test.pag', null, null, null, null, 2) ->> 'has_more')::boolean, true,
  'avisa que hay más páginas');
select is(jsonb_array_length(public.audit_events_page('test.pag', null, null, null, null, 2,
    (public.audit_events_page('test.pag', null, null, null, null, 2) #>> '{rows,1,id}')::bigint) -> 'rows'), 1,
  'la página siguiente continúa donde terminó la anterior');
reset role;
select ok(exists (select 1 from audit.events where action = 'read_sensitive'
  and target_type = 'audit_log' and metadata ->> 'resource' = 'audit_events'
  and actor_id = (select id from tu where k = 'adm')), 'la consulta de auditoría queda registrada');

select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok($$select public.audit_events_page()$$, '42501', null::text, 'el coordinador no lee la auditoría');
reset role;

select tests.authenticate_as((select id from tu where k = 'adm'), 'aal1');
select throws_ok($$select public.audit_events_page()$$, '42501', null::text, 'sin segundo factor no se lee la auditoría');
reset role;

-- Inicios de sesión
select tests.authenticate_as((select id from tu where k = 'adm'));
select is(jsonb_array_length(public.login_events_page((select id from tu where k = 'cli')) -> 'rows'), 2,
  'el admin lista los inicios de sesión de una cuenta');
select is(public.login_events_page(null, 'fallido') #>> '{rows,0,ip_address}', '10.0.0.9',
  'el filtro por resultado devuelve el intento fallido con su IP');
select throws_ok($$select public.login_events_page(null, 'raro')$$, '22023', null::text, 'el resultado se valida');
reset role;
select ok(exists (select 1 from audit.events where action = 'read_sensitive'
  and target_type = 'login_events' and metadata ->> 'resource' = 'login_events'), 'la consulta de inicios de sesión queda registrada');

select tests.authenticate_as((select id from tu where k = 'coo'));
select throws_ok($$select public.login_events_page()$$, '42501', null::text, 'el coordinador no lee inicios de sesión');
reset role;

-- Comercios
select is(tests.count_as((select id from tu where k = 'adm'), 'public.commerces_list'), 1::bigint, 'el admin ve los comercios');
select is(tests.count_as((select id from tu where k = 'coo'), 'public.commerces_list'), 0::bigint, 'el coordinador no ve comercios');
select is(tests.count_as_anon('public.commerces_list'), -1::bigint, 'anon no accede a la vista de comercios');

select * from finish();
rollback;
