begin;
select plan(8);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.addr', public.save_address(null, 'Casa', 'Barrio Central, casa 4', null, null)::text, true);
select is((select department from public.my_addresses where id = current_setting('t.addr')::uuid), null, 'una dirección nueva no trae departamento');
select lives_ok(format($$select public.set_address_department(%L, 'granada')$$, current_setting('t.addr')), 'el cliente fija el departamento de su dirección');
select is((select department from public.my_addresses where id = current_setting('t.addr')::uuid), 'granada', 'la libreta lo muestra');
select throws_ok(format($$select public.set_address_department(%L, 'atlantida')$$, current_setting('t.addr')), '22023', null::text, 'el departamento debe existir');
select lives_ok(format($$select public.set_address_department(%L, null)$$, current_setting('t.addr')), 'se puede quitar');
select throws_ok($$select public.set_address_department(gen_random_uuid(), 'managua')$$, 'P0002', null::text, 'la dirección debe existir');
reset role;

select tests.authenticate_as((select id from tu where k = 'cli2'));
select throws_ok(format($$select public.set_address_department(%L, 'managua')$$, current_setting('t.addr')), 'P0002', null::text, 'nadie cambia la dirección de otro cliente');
reset role;
select ok(not has_function_privilege('anon', 'public.set_address_department(uuid, text)', 'execute'), 'anon no ejecuta la función');

select * from finish();
rollback;
