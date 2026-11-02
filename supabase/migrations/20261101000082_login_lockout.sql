-- Límite de intentos fallidos de contraseña para todas las cuentas (consola, tienda y repartidor).
-- El ingreso con contraseña pasa por el servidor de cada app (server action): antes de llamar a Auth consulta
-- `login_guard_check` y, según el resultado, registra el fallo (`login_guard_fail`) o limpia el contador (`login_guard_success`).
-- Se cuenta por correo normalizado, exista o no la cuenta: la respuesta es la misma y no revela qué correos están registrados.
-- Solo cuenta la contraseña; el segundo factor (TOTP) de la consola no suma aquí.

create table private.login_attempts (
  email text primary key check (email = lower(btrim(email)) and email <> ''),
  failed_count int not null default 0 check (failed_count >= 0),
  last_failed_at timestamptz not null default now(),
  locked_until timestamptz
);

alter table private.login_attempts enable row level security;
revoke all on private.login_attempts from public, anon, authenticated;

-- Única fuente de los números de la regla: aviso tras el 5.º fallo, bloqueo tras el 6.º, 15 minutos de bloqueo.
-- Los fallos sueltos se olvidan tras 24 horas sin fallar. Las apps reciben estos valores en la respuesta; no los repiten.
create or replace function private.login_lock_policy(
  out warn_after int, out lock_after int, out lock_minutes int, out forget_after interval
) language sql immutable set search_path = '' as $$
  select 5, 6, 15, interval '24 hours'
$$;

-- Respuesta común: `locked` con los segundos que faltan, o `remaining` (intentos antes del bloqueo) y `warn` (último aviso).
create or replace function private.login_guard_state(p_row private.login_attempts)
returns jsonb language sql stable set search_path = '' as $$
  select case
    when p_row.locked_until is not null and p_row.locked_until > now() then
      jsonb_build_object('locked', true,
                         'retry_after_seconds', ceil(extract(epoch from p_row.locked_until - now()))::int,
                         'lock_minutes', p.lock_minutes)
    else
      jsonb_build_object('locked', false,
                         'remaining', greatest(p.lock_after - coalesce(p_row.failed_count, 0), 0),
                         'warn', coalesce(p_row.failed_count, 0) >= p.warn_after,
                         'lock_minutes', p.lock_minutes)
  end
  from private.login_lock_policy() p
$$;

create or replace function public.login_guard_check(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v private.login_attempts;
begin
  select * into v from private.login_attempts where email = lower(btrim(coalesce(p_email, '')));
  return private.login_guard_state(v);
end $$;

create or replace function public.login_guard_fail(p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v private.login_attempts;
  p record;
begin
  if v_email = '' then
    raise exception 'correo requerido' using errcode = '22023';
  end if;
  select * into p from private.login_lock_policy();

  insert into private.login_attempts (email, failed_count) values (v_email, 0) on conflict (email) do nothing;
  select * into v from private.login_attempts where email = v_email for update;

  -- Durante el bloqueo no se suma: el intento ni siquiera llega a Auth.
  if v.locked_until is not null and v.locked_until > now() then
    return private.login_guard_state(v);
  end if;
  -- Un bloqueo vencido o fallos viejos empiezan la cuenta de nuevo.
  if v.locked_until is not null or v.last_failed_at < now() - p.forget_after then
    v.failed_count := 0;
    v.locked_until := null;
  end if;

  v.failed_count := v.failed_count + 1;
  v.last_failed_at := now();
  if v.failed_count >= p.lock_after then
    v.locked_until := now() + make_interval(mins => p.lock_minutes);
  end if;

  update private.login_attempts
     set failed_count = v.failed_count, last_failed_at = v.last_failed_at, locked_until = v.locked_until
   where email = v_email;
  return private.login_guard_state(v);
end $$;

-- Solo con la sesión recién abierta: limpia el contador de su propio correo, nunca el de otra cuenta.
create or replace function public.login_guard_success()
returns void language sql security definer set search_path = '' as $$
  delete from private.login_attempts
   where email = (select lower(btrim(u.email)) from auth.users u where u.id = auth.uid());
$$;

-- El servidor de las apps llama a estas funciones con la clave pública (la de servicio no va a las apps).
-- Consultar o sumar un fallo no da más de lo que ya da escribir mal la contraseña en el formulario;
-- reiniciar el contador sí exige haber entrado.
revoke all on function public.login_guard_check(text) from public;
revoke all on function public.login_guard_fail(text) from public;
revoke all on function public.login_guard_success() from public, anon;
grant execute on function public.login_guard_check(text) to anon, authenticated;
grant execute on function public.login_guard_fail(text) to anon, authenticated;
grant execute on function public.login_guard_success() to authenticated;

-- Correos que fallaron alguna vez y no volvieron (por ejemplo, inexistentes): se borran cuando ya no cuentan.
create or replace function private.purge_login_attempts()
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  delete from private.login_attempts
   where last_failed_at < now() - (select forget_after from private.login_lock_policy())
     and (locked_until is null or locked_until < now());
  get diagnostics v_count = row_count;
  return v_count;
end $$;

select cron.schedule('purge-login-attempts', '45 3 * * *', $$select private.purge_login_attempts()$$);
