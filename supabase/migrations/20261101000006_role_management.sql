-- Otorga un rol de forma idempotente. Solo la usan otras funciones del servidor.
create or replace function private.grant_role(
  p_user uuid, p_role identity.app_role, p_commerce uuid, p_by uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into identity.user_roles (user_id, role, commerce_id, granted_by)
  select p_user, p_role, p_commerce, p_by
  where not exists (
    select 1 from identity.user_roles
    where user_id = p_user and role = p_role and status <> 'revocado')
  returning id into v_id;

  if v_id is not null then
    perform private.write_audit('role.granted', 'user_role', v_id::text, null,
      jsonb_build_object('role', p_role, 'user_id', p_user, 'commerce_id', p_commerce));
  end if;
end $$;

create or replace function private.change_role_status(
  p_user uuid, p_role identity.app_role, p_new identity.role_status, p_reason text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_row identity.user_roles;
  v_action text;
begin
  perform private.require_console_session();
  if p_role = 'superadmin' then
    raise exception 'el rol superadmin solo se gestiona por código' using errcode = '42501';
  end if;
  if not private.can_manage(p_role) then
    raise exception 'no tienes permiso para gestionar el rol %', p_role using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'no puedes gestionar tus propios roles' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'el motivo es obligatorio (mínimo 5 caracteres)' using errcode = '22023';
  end if;

  select * into v_row from identity.user_roles
  where user_id = p_user and role = p_role and status <> 'revocado'
  for update;
  if not found then
    raise exception 'el usuario no tiene el rol % activo ni suspendido', p_role using errcode = 'P0002';
  end if;

  if not ((v_row.status = 'activo' and p_new in ('suspendido', 'revocado'))
       or (v_row.status = 'suspendido' and p_new in ('activo', 'revocado'))) then
    raise exception 'transición no permitida: % a %', v_row.status, p_new using errcode = '22023';
  end if;

  update identity.user_roles
     set status = p_new, status_reason = btrim(p_reason),
         status_changed_at = now(), status_changed_by = auth.uid()
   where id = v_row.id;

  v_action := case p_new
    when 'suspendido' then 'role.suspended'
    when 'revocado' then 'role.revoked'
    else 'role.reactivated' end;
  perform private.write_audit(v_action, 'user_role', v_row.id::text,
    jsonb_build_object('status', v_row.status, 'role', p_role, 'user_id', p_user),
    jsonb_build_object('status', p_new, 'role', p_role, 'user_id', p_user),
    btrim(p_reason));
end $$;

create or replace function public.suspend_role(p_user uuid, p_role identity.app_role, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin perform private.change_role_status(p_user, p_role, 'suspendido', p_reason); end $$;

create or replace function public.reactivate_role(p_user uuid, p_role identity.app_role, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin perform private.change_role_status(p_user, p_role, 'activo', p_reason); end $$;

create or replace function public.revoke_role(p_user uuid, p_role identity.app_role, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin perform private.change_role_status(p_user, p_role, 'revocado', p_reason); end $$;

revoke all on function public.suspend_role(uuid, identity.app_role, text) from public, anon;
revoke all on function public.reactivate_role(uuid, identity.app_role, text) from public, anon;
revoke all on function public.revoke_role(uuid, identity.app_role, text) from public, anon;
grant execute on function public.suspend_role(uuid, identity.app_role, text) to authenticated;
grant execute on function public.reactivate_role(uuid, identity.app_role, text) to authenticated;
grant execute on function public.revoke_role(uuid, identity.app_role, text) to authenticated;

-- Solo el servidor (scripts/seed-superadmin) puede sembrar al superadmin.
create or replace function public.bootstrap_superadmin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from identity.profiles where id = p_user) then
    raise exception 'usuario inexistente' using errcode = 'P0002';
  end if;
  perform private.grant_role(p_user, 'superadmin', null, null);
end $$;

revoke all on function public.bootstrap_superadmin(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_superadmin(uuid) to service_role;