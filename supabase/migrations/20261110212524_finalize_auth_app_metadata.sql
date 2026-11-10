-- Auth puede aplicar app_metadata después del INSERT inicial, dentro de la misma transacción.
-- Se conserva el alta inmediata del perfil y se finaliza su app al confirmar esa alta; las actualizaciones posteriores
-- de metadatos no cambian la app y user_metadata nunca interviene en esta decisión.
create or replace function private.finalize_new_account_app()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_app text;
  v_existing text;
  v_previous_setting text := current_setting('rapitrip.allow_app_change', true);
begin
  select u.raw_app_meta_data ->> 'rapitrip_app' into v_app from auth.users u where u.id = new.id;
  if not found or v_app is null or v_app not in ('consola', 'repartidor') then
    return null;
  end if;
  select p.app into v_existing from identity.profiles p where p.id = new.id;
  if v_existing is not distinct from v_app then
    return null;
  end if;
  if v_existing is distinct from 'tienda' or exists (
    select 1 from identity.user_roles where user_id = new.id and role <> 'cliente'
  ) then
    raise exception 'la app inicial de la cuenta no coincide con sus roles' using errcode = '42501';
  end if;
  delete from identity.user_roles where user_id = new.id and role = 'cliente';
  perform set_config('rapitrip.allow_app_change', 'on', true);
  update identity.profiles set app = v_app where id = new.id;
  perform set_config('rapitrip.allow_app_change', coalesce(v_previous_setting, 'off'), true);
  return null;
end $$;

revoke all on function private.finalize_new_account_app() from public, anon, authenticated;

create constraint trigger on_auth_user_app_finalized
  after insert on auth.users
  deferrable initially deferred
  for each row execute function private.finalize_new_account_app();
