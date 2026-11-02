begin;
select plan(18);

select is(public.login_guard_check('nadie@t.test') ->> 'remaining', '6', 'un correo sin fallos tiene los 6 intentos');

-- Cuatro fallos: sin aviso todavía. El correo se normaliza (mayúsculas y espacios cuentan como el mismo).
select public.login_guard_fail('Ana@T.test') from generate_series(1, 3);
select is(public.login_guard_fail(' ana@t.test ') ->> 'warn', 'false', 'el 4.º fallo no avisa');
select is((select failed_count from private.login_attempts where email = 'ana@t.test'), 4, 'los fallos se guardan con el correo normalizado');

select is(public.login_guard_fail('ana@t.test'), '{"locked": false, "remaining": 1, "warn": true, "lock_minutes": 15}'::jsonb,
  'el 5.º fallo avisa que queda un último intento');
select is(public.login_guard_check('ana@t.test') ->> 'warn', 'true', 'la consulta previa también trae el aviso');

select is(public.login_guard_fail('ana@t.test') ->> 'locked', 'true', 'el 6.º fallo bloquea la cuenta');
select ok((public.login_guard_check('ana@t.test') ->> 'retry_after_seconds')::int between 899 and 900,
  'el bloqueo dura 15 minutos');
select public.login_guard_fail('ana@t.test');
select is((select failed_count from private.login_attempts where email = 'ana@t.test'), 6, 'durante el bloqueo no se suman fallos');

-- Al vencer el bloqueo la cuenta empieza de nuevo.
update private.login_attempts set locked_until = now() - interval '1 second' where email = 'ana@t.test';
select is(public.login_guard_check('ana@t.test') ->> 'locked', 'false', 'el bloqueo vencido ya no rechaza');
select is(public.login_guard_fail('ana@t.test') ->> 'remaining', '5', 'tras un bloqueo vencido el primer fallo vuelve a contar desde 1');

-- Un ingreso correcto limpia el contador de esa cuenta y de ninguna otra.
select public.login_guard_fail('otra@t.test');
select tests.authenticate_as(tests.create_user('Ana@t.test'));
select public.login_guard_success();
reset role;
select is(public.login_guard_check('ana@t.test') ->> 'remaining', '6', 'entrar bien reinicia el contador');
select is(public.login_guard_check('otra@t.test') ->> 'remaining', '5', 'no toca el contador de otro correo');

-- Fallos viejos se olvidan.
select public.login_guard_fail('beto@t.test') from generate_series(1, 5);
update private.login_attempts set last_failed_at = now() - interval '25 hours' where email = 'beto@t.test';
select is(public.login_guard_fail('beto@t.test') ->> 'remaining', '5', 'fallos de hace más de 24 horas no cuentan');
select is(private.purge_login_attempts(), 0, 'la limpieza no borra correos con fallos recientes');
update private.login_attempts set last_failed_at = now() - interval '25 hours' where email = 'beto@t.test';
select is(private.purge_login_attempts(), 1, 'la limpieza borra correos sin fallos recientes');

-- Sin sesión se puede consultar y sumar fallos (igual que escribiendo mal la contraseña), pero no reiniciar.
set local role anon;
select lives_ok($$select public.login_guard_fail('carla@t.test')$$, 'sin sesión se registra el fallo');
select throws_ok($$select public.login_guard_success()$$, '42501', null::text, 'sin sesión no se reinicia el contador');
reset role;
select ok(not has_table_privilege('anon', 'private.login_attempts', 'select'), 'la tabla no es legible desde la API');

select * from finish();
rollback;
