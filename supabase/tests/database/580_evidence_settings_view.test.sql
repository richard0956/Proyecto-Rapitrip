begin;
select plan(7);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm', tests.create_user('adm@t.test');
insert into tu select 'coo', tests.create_user('coo@t.test');
insert into tu select 'caj', tests.create_user('caj@t.test');
insert into tu select 'cli', tests.create_user('cli@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'coo'), 'coordinador');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');

select tests.authenticate_as((select id from tu where k = 'adm'));
select is((select count(*) from public.evidence_settings_list), 1::bigint, 'la administración lee las reglas de evidencia');
select is((select retention_days from public.evidence_settings_list), 90, 'con la conservación acordada de 90 días (3 meses)');
select is((select alert_distance_m from public.evidence_settings_list), 150, 'y la distancia de alerta de 150 m');
select lives_ok($$select public.set_evidence_settings(true, true, true, false, 200, 60)$$, 'la administración cambia las reglas');
select is((select (require_delivery_code::text || ':' || alert_distance_m || ':' || retention_days) from public.evidence_settings_list), 'false:200:60', 'y la vista refleja el cambio');
reset role;
select tests.authenticate_as((select id from tu where k = 'coo'));
select is((select count(*) from public.evidence_settings_list), 1::bigint, 'la coordinación también las lee');
reset role;
select tests.authenticate_as((select id from tu where k = 'cli'));
select is((select count(*) from public.evidence_settings_list), 0::bigint, 'un cliente no las ve');
reset role;

select * from finish();
rollback;
