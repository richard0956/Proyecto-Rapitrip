-- Solo local. `supabase db push` nunca ejecuta seeds, así que esto no llega a producción.
create schema if not exists tests;

create or replace function tests.create_user(p_email text, p_full_name text default null)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    p_email, now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(p_full_name, p_email)),
    now(), now(), '', '', '', ''
  );
  return v_id;
end $$;

-- plpgsql (no sql) y p_role como text: Postgres revisa tablas y tipos de una función sql al
-- crearla, y estas se crean antes que las migraciones de identidad.
create or replace function tests.create_commerce(p_name text default 'Comercio de prueba')
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into identity.commerces (name) values (p_name) returning id into v_id;
  return v_id;
end $$;

create or replace function tests.grant_role(p_user uuid, p_role text, p_commerce uuid default null)
returns void language plpgsql as $$
begin
  insert into identity.user_roles (user_id, role, commerce_id)
  values (p_user, p_role::identity.app_role, p_commerce);
end $$;

create or replace function tests.touch(p_user uuid, p_ago interval default '0 seconds')
returns void language plpgsql as $$
begin
  -- La tabla nace en la Tarea 5; las pruebas anteriores no la necesitan.
  if to_regclass('private.session_activity') is null then
    return;
  end if;
  insert into private.session_activity (session_id, user_id, last_activity_at)
  values (p_user, p_user, now() - p_ago)
  on conflict (session_id) do update set last_activity_at = excluded.last_activity_at;
end $$;

create or replace function tests.set_claims(p_user uuid, p_aal text default 'aal2', p_amr jsonb default null)
returns void language plpgsql as $$
declare
  v_now bigint := extract(epoch from now())::bigint;
  v_amr jsonb := coalesce(p_amr,
    case p_aal
      when 'aal2' then jsonb_build_array(
        jsonb_build_object('method', 'totp', 'timestamp', v_now),
        jsonb_build_object('method', 'password', 'timestamp', v_now - 30))
      else jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', v_now))
    end);
begin
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', p_user, 'role', 'authenticated', 'aal', p_aal, 'amr', v_amr,
    'session_id', p_user)::text, true);
end $$;

create or replace function tests.authenticate_as(p_user uuid, p_aal text default 'aal2', p_amr jsonb default null)
returns void language plpgsql as $$
begin
  perform tests.touch(p_user);
  perform tests.set_claims(p_user, p_aal, p_amr);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function tests.authenticate_as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end $$;

create or replace function tests.count_as(p_user uuid, p_rel text, p_aal text default 'aal2')
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform tests.authenticate_as(p_user, p_aal);
  begin
    execute format('select count(*) from %s', p_rel) into n;
  exception when insufficient_privilege then
    n := -1;
  end;
  reset role;
  return n;
end $$;

create or replace function tests.count_as_anon(p_rel text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform tests.authenticate_as_anon();
  begin
    execute format('select count(*) from %s', p_rel) into n;
  exception when insufficient_privilege then
    n := -1;
  end;
  reset role;
  return n;
end $$;