begin;
select plan(13);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'cli', tests.create_user('cli470@t.test');

select tests.authenticate_as((select id from tu where k = 'cli'));
select is(public.department_for_point(12.1364, -86.2514), 'managua', 'el centro de Managua cae en Managua');
select is(public.department_for_point(12.4379, -86.8780), 'leon', 'León');
select is(public.department_for_point(12.9296, -85.9175), 'matagalpa', 'Matagalpa');
select is(public.department_for_point(11.9299, -85.9560), 'granada', 'Granada');
select is(public.department_for_point(11.9740, -86.0940), 'masaya', 'Masaya');
select is(public.department_for_point(13.0910, -86.3540), 'esteli', 'Estelí');
select is(public.department_for_point(14.0390, -83.3870), 'raccn', 'Puerto Cabezas, Costa Caribe Norte');
select is(public.department_for_point(12.0130, -83.7640), 'raccs', 'Bluefields, Costa Caribe Sur');
select is(public.department_for_point(11.1230, -84.7750), 'rio_san_juan', 'San Carlos, Río San Juan');
select is(public.department_for_point(40.4, -3.7), null, 'un punto fuera de Nicaragua no tiene departamento');
select is(public.department_for_point(null, null), null, 'sin punto no hay departamento');
reset role;

select is((select count(distinct department)::int from sales.department_anchors), 17, 'cada departamento y región tiene puntos de referencia');
select ok(not has_function_privilege('anon', 'public.department_for_point(numeric, numeric)', 'execute'), 'anon no ejecuta la función');

select * from finish();
rollback;
