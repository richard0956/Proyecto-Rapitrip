begin;
select plan(2);
select ok(true, 'pgTAP corre');
select has_function('tests', 'create_user', array['text', 'text'], 'las utilidades de prueba están cargadas');
select * from finish();
rollback;