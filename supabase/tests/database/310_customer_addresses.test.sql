begin;
select plan(19);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
insert into tu select 'cli2', tests.create_user('cli2@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');

select tests.authenticate_as((select id from tu where k = 'cli'));
select set_config('t.a1', public.save_address(null, 'Casa', 'Barrio Central, casa 4', 'portón azul', '88881111')::text, true);
select ok((select is_default from public.my_addresses where id = current_setting('t.a1')::uuid), 'la primera dirección queda como predeterminada');
select set_config('t.a2', public.save_address(null, 'Oficina', 'Km 5 carretera norte', null, null)::text, true);
select ok(not (select is_default from public.my_addresses where id = current_setting('t.a2')::uuid), 'la segunda no lo es por defecto');
select throws_ok($$select public.save_address(null, 'casa', 'Otra dirección larga', null, null)$$, '23505', null::text, 'el nombre no se repite (sin distinguir mayúsculas)');
select throws_ok($$select public.save_address(null, 'X', 'abc', null, null)$$, '22023', null::text, 'la dirección exige al menos 5 caracteres');
select throws_ok($$select public.save_address(null, 'Y', 'Dirección válida', null, 'hola')$$, '22023', null::text, 'el teléfono se valida');
select throws_ok($$select public.save_address(null, 'Z', 'Dirección válida', null, null, false, 12.1, null)$$, '22023', null::text,
  'las coordenadas van completas o no van');

select lives_ok(format($$select public.set_default_address(%L)$$, current_setting('t.a2')), 'cambiar la predeterminada');
select is((select count(*)::int from public.my_addresses where is_default), 1, 'siempre hay una sola predeterminada');
select ok((select is_default from public.my_addresses where id = current_setting('t.a2')::uuid), 'la nueva es la predeterminada');

select lives_ok(format($$select public.save_address(%L, 'Oficina', 'Km 5 carretera norte, edificio 2', 'segundo piso', '22221111', false, 12.136400, -86.251400)$$,
  current_setting('t.a2')), 'editar una dirección propia (con coordenadas reservadas para el mapa)');
select is((select reference from public.my_addresses where id = current_setting('t.a2')::uuid), 'segundo piso', 'la edición se guarda');
select ok((select is_default from public.my_addresses where id = current_setting('t.a2')::uuid), 'editar no quita la predeterminada');

-- Aislamiento
reset role;
select tests.authenticate_as((select id from tu where k = 'cli2'));
select is((select count(*)::int from public.my_addresses), 0, 'otro cliente no ve las direcciones ajenas');
select throws_ok(format($$select public.delete_address(%L)$$, current_setting('t.a1')), 'P0002', null::text, 'ni puede borrarlas');
select throws_ok(format($$select public.save_address(%L, 'Mía', 'Dirección válida 123')$$, current_setting('t.a1')), 'P0002', null::text, 'ni editarlas');

-- Borrar la predeterminada pasa la marca a otra
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select lives_ok(format($$select public.delete_address(%L)$$, current_setting('t.a2')), 'eliminar la predeterminada');
select ok((select is_default from public.my_addresses where id = current_setting('t.a1')::uuid), 'la que queda pasa a ser la predeterminada');

-- Tope de 10
do $$ begin
  for i in 1..9 loop
    perform public.save_address(null, 'Extra ' || i, 'Dirección extra número ' || i);
  end loop;
end $$;
select throws_ok($$select public.save_address(null, 'Once', 'Dirección número once')$$, '22023', null::text, 'el tope es de 10 direcciones');
reset role;

-- Anonimizar la cuenta borra la libreta
update identity.profiles set status = 'anonimizada' where id = (select id from tu where k = 'cli');
select is((select count(*)::int from sales.customer_addresses where client_id = (select id from tu where k = 'cli')), 0, 'anonimizar borra las direcciones');

select * from finish();
rollback;
