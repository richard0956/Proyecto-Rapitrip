-- Repartidor, etapa 1b: cuenta de acceso, vínculo con la ficha y disponibilidad.
-- Diseño: docs/informe/2026-10-23-repartidor-revision-evidencias-y-consolas.md (etapa 1).
--
--   * La administración invita al repartidor desde su ficha (`create_courier_invitation`). El rol `repartidor` no se otorga
--     por la invitación genérica: así cuenta y ficha nacen siempre unidas.
--   * Al aceptar la invitación se llena `identity.couriers.user_id`.
--   * `private.is_courier_session()` es la comprobación que usarán todas las funciones y vistas del repartidor: rol activo,
--     ficha activa y sesión de hasta 12 horas. Sin segundo factor (decisión D4); el riesgo se acota porque el repartidor solo
--     ve y actúa sobre lo que se le asigna.
--   * La administración puede revocar la cuenta (`revoke_courier_account`) y desactivar la ficha: ambas cierran sus sesiones.

-- Rol y matriz de gestión ------------------------------------------------------------------------------------------------
insert into private.role_management (manager, target) values
  ('superadmin', 'repartidor'), ('admin', 'repartidor')
on conflict do nothing;

-- Ficha: un usuario, un repartidor; y disponibilidad ---------------------------------------------------------------------
create unique index couriers_one_ficha_per_user on identity.couriers (user_id) where user_id is not null;

alter table identity.couriers
  add column available boolean not null default false,
  add column available_since timestamptz,
  add constraint couriers_available_needs_account check (not available or user_id is not null);

grant select (available, available_since) on identity.couriers to authenticated;

-- Invitaciones ---------------------------------------------------------------------------------------------------------
alter table identity.invitations drop constraint invitations_role_check;
alter table identity.invitations add constraint invitations_role_check
  check (role in ('admin', 'cajero', 'coordinador', 'repartidor'));
alter table identity.invitations add column courier_id uuid references identity.couriers(id);
alter table identity.invitations add constraint invitations_courier_role
  check ((role = 'repartidor') = (courier_id is not null));
grant select (courier_id) on identity.invitations to authenticated;

-- Sesión del repartidor ------------------------------------------------------------------------------------------------
create or replace function private.is_courier_session()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_sid uuid;
begin
  if auth.uid() is null then return false; end if;
  if not private.has_role('repartidor') then return false; end if;
  begin
    v_sid := nullif(private.jwt_claims() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if v_sid is null then return false; end if;
  return exists (
           select 1 from auth.sessions s
           where s.id = v_sid and s.user_id = auth.uid() and s.created_at > now() - interval '12 hours')
     and exists (
           select 1 from identity.couriers c where c.user_id = auth.uid() and c.status = 'activo');
end $$;

-- Ficha del repartidor de la sesión actual (nula si la sesión no es de repartidor).
create or replace function private.current_courier_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select c.id from identity.couriers c
   where c.user_id = auth.uid() and c.status = 'activo' and private.is_courier_session();
$$;

grant execute on function private.is_courier_session(), private.current_courier_id() to authenticated;

-- El repartidor lee su propia ficha (sin document_path: los permisos son por columna).
create policy couriers_select_own on identity.couriers
  for select to authenticated using (user_id = auth.uid() and private.is_courier_session());

-- Invitar desde la ficha -----------------------------------------------------------------------------------------------
create or replace function public.create_courier_invitation(p_courier uuid, p_email text, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_courier identity.couriers;
  v_id uuid;
  v_prev uuid;
  v_exp timestamptz := now() + interval '4 days';
begin
  perform private.require_console_session();
  if not private.can_manage('repartidor') then
    raise exception 'no tienes permiso para invitar repartidores' using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'correo inválido' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash de token inválido' using errcode = '22023';
  end if;
  select * into v_courier from identity.couriers where id = p_courier for update;
  if not found then
    raise exception 'repartidor inexistente' using errcode = 'P0002';
  end if;
  if v_courier.status <> 'activo' then
    raise exception 'activa la ficha del repartidor antes de invitarlo' using errcode = '22023';
  end if;
  if v_courier.user_id is not null then
    raise exception 'ese repartidor ya tiene una cuenta' using errcode = '23505';
  end if;
  if exists (
    select 1 from identity.profile_pii pii
    join identity.user_roles ur on ur.user_id = pii.user_id
    where lower(pii.email) = v_email and ur.role = 'repartidor' and ur.status <> 'revocado'
  ) then
    raise exception 'esa persona ya tiene el rol repartidor' using errcode = '23505';
  end if;

  update identity.invitations set status = 'cancelada'
   where courier_id = p_courier and status = 'pendiente'
  returning id into v_prev;

  insert into identity.invitations (email, role, courier_id, invited_by, token_hash, expires_at)
  values (v_email, 'repartidor', p_courier, auth.uid(), p_token_hash, v_exp)
  returning id into v_id;

  perform private.write_audit('invitation.created', 'invitation', v_id::text, null,
    jsonb_build_object('role', 'repartidor', 'courier_id', p_courier, 'replaced', v_prev));
  return jsonb_build_object('id', v_id, 'expires_at', v_exp);
end $$;

-- Aceptar: además del rol, vincula la cuenta con la ficha. La Edge Function accept-invitation no cambia.
create or replace function public.finish_accept_invitation(p_token_hash text, p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v identity.invitations;
begin
  select * into v from identity.invitations where token_hash = p_token_hash for update;
  if not found or v.status <> 'pendiente' or v.expires_at <= now() then
    return false;
  end if;
  -- La cuenta debe ser la del correo invitado.
  if not exists (select 1 from identity.profile_pii where user_id = p_user and lower(email) = lower(v.email)) then
    return false;
  end if;
  if v.role = 'repartidor' then
    -- La ficha debe seguir activa y libre, y la cuenta no puede estar ya vinculada a otra ficha.
    if exists (select 1 from identity.couriers where user_id = p_user) then
      return false;
    end if;
    update identity.couriers set user_id = p_user, updated_at = now()
     where id = v.courier_id and status = 'activo' and user_id is null;
    if not found then
      return false;
    end if;
    perform private.write_audit('courier.account_linked', 'courier', v.courier_id::text, null,
      jsonb_build_object('user_id', p_user));
  end if;
  perform private.grant_role(p_user, v.role, null, v.invited_by);
  update identity.invitations
     set status = 'aceptada', accepted_at = now(), accepted_by = p_user
   where id = v.id;
  perform private.write_audit('invitation.accepted', 'invitation', v.id::text, null,
    jsonb_build_object('role', v.role, 'user_id', p_user));
  return true;
end $$;

-- Desactivar la ficha corta el acceso de inmediato ---------------------------------------------------------------------
create or replace function public.set_courier_status(p_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old identity.couriers;
begin
  perform private.require_admin_console();
  if p_status not in ('activo', 'inactivo') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'el motivo es obligatorio (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  select * into v_old from identity.couriers where id = p_id for update;
  if not found then
    raise exception 'repartidor inexistente' using errcode = 'P0002';
  end if;
  update identity.couriers
     set status = p_status, updated_at = now(),
         available = case when p_status = 'inactivo' then false else available end,
         available_since = case when p_status = 'inactivo' then null else available_since end
   where id = p_id;
  if p_status = 'inactivo' and v_old.user_id is not null then
    delete from auth.sessions where user_id = v_old.user_id;
  end if;
  perform private.write_audit('courier.status_changed', 'courier', p_id::text,
    jsonb_build_object('status', v_old.status), jsonb_build_object('status', p_status), btrim(p_reason));
end $$;

-- Revocar la cuenta: quita el rol, suelta la ficha y cierra sus sesiones -------------------------------------------------
create or replace function public.revoke_courier_account(p_courier uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v identity.couriers;
begin
  perform private.require_admin_console();
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'el motivo es obligatorio (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  select * into v from identity.couriers where id = p_courier for update;
  if not found then
    raise exception 'repartidor inexistente' using errcode = 'P0002';
  end if;
  if v.user_id is null then
    raise exception 'ese repartidor no tiene cuenta' using errcode = '22023';
  end if;
  if exists (select 1 from identity.user_roles where user_id = v.user_id and role = 'repartidor' and status <> 'revocado') then
    perform private.change_role_status(v.user_id, 'repartidor', 'revocado', p_reason);
  end if;
  delete from auth.sessions where user_id = v.user_id;
  update identity.couriers
     set user_id = null, available = false, available_since = null, updated_at = now()
   where id = p_courier;
  perform private.write_audit('courier.account_revoked', 'courier', p_courier::text, null,
    jsonb_build_object('user_id', v.user_id), btrim(p_reason));
end $$;

-- Disponibilidad -------------------------------------------------------------------------------------------------------
create or replace function public.courier_set_available(p_available boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid := private.current_courier_id();
begin
  if v_id is null then
    raise exception 'solo un repartidor con sesión activa puede cambiar su disponibilidad' using errcode = '42501';
  end if;
  if p_available is null then
    raise exception 'indica si estás disponible' using errcode = '22023';
  end if;
  -- Idempotente: repetir el mismo valor (por una mala señal) no cambia nada ni ensucia la auditoría.
  update identity.couriers
     set available = p_available, available_since = case when p_available then now() else null end, updated_at = now()
   where id = v_id and available is distinct from p_available;
  if found then
    perform private.write_audit('courier.availability_changed', 'courier', v_id::text, null,
      jsonb_build_object('available', p_available));
  end if;
end $$;

-- Vistas ---------------------------------------------------------------------------------------------------------------
-- Ficha propia del repartidor.
create view public.courier_me with (security_invoker = true) as
  select id, full_name, phone, vehicle_type, vehicle_class, department, status, available, available_since
  from identity.couriers
  where user_id = auth.uid() and private.is_courier_session();

-- Coordinación y administración ven la disponibilidad (las columnas nuevas van al final de la vista).
create or replace view public.couriers_list with (security_invoker = true) as
  select id, full_name, phone, vehicle_type, status, user_id, created_at, vehicle_class, department, available, available_since
  from identity.couriers;

-- Invitaciones de repartidores pendientes o recientes (solo administración, por la política de la tabla).
create view public.courier_invitations with (security_invoker = true) as
  select id, courier_id, email, status, expires_at, created_at, accepted_at
  from identity.invitations
  where role = 'repartidor';

revoke all on public.courier_me, public.courier_invitations from public, anon;
grant select on public.courier_me, public.courier_invitations to authenticated;

revoke all on function
  public.create_courier_invitation(uuid, text, text),
  public.revoke_courier_account(uuid, text),
  public.courier_set_available(boolean)
from public, anon;
grant execute on function
  public.create_courier_invitation(uuid, text, text),
  public.revoke_courier_account(uuid, text),
  public.courier_set_available(boolean)
to authenticated;
