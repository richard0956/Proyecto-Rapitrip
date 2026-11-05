-- Zero Trust: cada cuenta pertenece a una sola app y nunca se cruza con otra.
--   tienda     → solo el rol cliente (se registra sola en la tienda).
--   consola    → superadmin, admin, cajero, coordinador o comercio (solo por invitación; el equipo, con correo institucional).
--   repartidor → solo el rol repartidor (por invitación desde su ficha).
-- Una persona que es cliente y además trabaja en Rapitrip tiene dos cuentas con correos distintos.

-- 1. La app de cada cuenta ---------------------------------------------------------------------------------------------
alter table identity.profiles add column app text not null default 'tienda'
  constraint profiles_app_check check (app in ('tienda', 'consola', 'repartidor'));

create or replace function private.role_app(p_role identity.app_role)
returns text language sql immutable set search_path = '' as $$
  select case p_role::text when 'cliente' then 'tienda' when 'repartidor' then 'repartidor' else 'consola' end;
$$;

-- Las cuentas que ya existen quedan en la app de sus roles de trabajo; el rol de cliente que traían se revoca.
update identity.profiles p set app = case
  when exists (select 1 from identity.user_roles ur where ur.user_id = p.id and ur.status <> 'revocado'
               and ur.role::text not in ('cliente', 'repartidor')) then 'consola'
  when exists (select 1 from identity.user_roles ur where ur.user_id = p.id and ur.status <> 'revocado'
               and ur.role::text = 'repartidor') then 'repartidor'
  else 'tienda' end;

with cut as (
  update identity.user_roles ur
     set status = 'revocado', status_reason = 'Separación de cuentas por app (Zero Trust)', status_changed_at = now()
    from identity.profiles p
   where p.id = ur.user_id and ur.status <> 'revocado' and private.role_app(ur.role) <> p.app
  returning ur.id, ur.user_id, ur.role
)
insert into audit.events (action, target_type, target_id, after_data, reason)
select 'role.revoked', 'user_role', cut.id::text, jsonb_build_object('role', cut.role, 'user_id', cut.user_id),
       'Separación de cuentas por app (Zero Trust)'
  from cut;

-- La app no cambia nunca (solo las utilidades de prueba pueden hacerlo, con una marca de la transacción).
create or replace function private.protect_profile_app()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.app is distinct from old.app and coalesce(current_setting('rapitrip.allow_app_change', true), '') <> 'on' then
    raise exception 'la app de una cuenta no se cambia' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_app_is_fixed
  before update of app on identity.profiles
  for each row execute function private.protect_profile_app();

-- Ningún rol vivo puede ser de otra app que la de su cuenta.
create or replace function private.enforce_role_app()
returns trigger language plpgsql set search_path = '' as $$
declare v_app text;
begin
  if new.status = 'revocado' then
    return new;
  end if;
  select app into v_app from identity.profiles where id = new.user_id;
  if v_app is distinct from private.role_app(new.role) then
    raise exception 'esta cuenta es de la app % y no puede tener el rol %', coalesce(v_app, '?'), new.role
      using errcode = '42501';
  end if;
  return new;
end $$;

create trigger user_roles_one_app
  before insert or update of role, status on identity.user_roles
  for each row execute function private.enforce_role_app();

-- El alta: la app la fija solo el servidor (app_metadata.rapitrip_app, que el usuario no puede tocar). Sin marca es una
-- cuenta de la tienda, la única que se crea sola, y solo esa recibe el rol de cliente.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_app text := coalesce(nullif(new.raw_app_meta_data ->> 'rapitrip_app', ''), 'tienda');
begin
  if v_app not in ('tienda', 'consola', 'repartidor') then
    v_app := 'tienda';
  end if;
  insert into identity.profiles (id, last_sign_in_at, app) values (new.id, new.last_sign_in_at, v_app);
  insert into identity.profile_pii (user_id, full_name, email)
    values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  if v_app = 'tienda' then
    insert into identity.user_roles (user_id, role) values (new.id, 'cliente');
  end if;
  return new;
end $$;

-- La app de la cuenta, para cada sesión.
create or replace view public.my_account_app with (security_invoker = true) as
  select app from identity.profiles where id = auth.uid();
grant select (id, app) on identity.profiles to authenticated;
grant select on public.my_account_app to authenticated;

-- La app de una cuenta existente con ese correo (o null). Solo para funciones del servidor.
create or replace function private.email_app(p_email text)
returns text language sql stable security definer set search_path = '' as $$
  select p.app from identity.profile_pii pii join identity.profiles p on p.id = pii.user_id
   where lower(pii.email) = lower(btrim(p_email)) limit 1;
$$;

-- 2. Correos institucionales del equipo ---------------------------------------------------------------------------------
create table identity.institutional_domains (
  domain text primary key constraint institutional_domain_format check (domain ~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$'),
  added_by uuid references identity.profiles(id),
  created_at timestamptz not null default now()
);
alter table identity.institutional_domains enable row level security;
revoke all on identity.institutional_domains from public, anon, authenticated;

create or replace function private.is_institutional_email(p_email text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from identity.institutional_domains d where d.domain = lower(split_part(btrim(p_email), '@', 2)));
$$;

create or replace function public.list_institutional_domains()
returns table (domain text, created_at timestamptz) language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_console_session();
  if not private.has_any_role(array['admin', 'superadmin']::identity.app_role[]) then
    raise exception 'no tienes permiso para ver los dominios' using errcode = '42501';
  end if;
  return query select d.domain, d.created_at from identity.institutional_domains d order by d.domain;
end $$;

create or replace function public.add_institutional_domain(p_domain text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_domain text := lower(btrim(trim(leading '@' from coalesce(p_domain, ''))));
begin
  perform private.require_console_session();
  if not private.has_any_role(array['superadmin']::identity.app_role[]) then
    raise exception 'solo la dirección agrega dominios institucionales' using errcode = '42501';
  end if;
  if v_domain !~ '^[a-z0-9-]+(\.[a-z0-9-]+)+$' then
    raise exception 'escribe un dominio como rapitrip.com' using errcode = '22023';
  end if;
  insert into identity.institutional_domains (domain, added_by) values (v_domain, auth.uid()) on conflict do nothing;
  perform private.write_audit('institutional_domain.added', 'institutional_domain', v_domain);
end $$;

create or replace function public.remove_institutional_domain(p_domain text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_domain text := lower(btrim(coalesce(p_domain, '')));
begin
  perform private.require_console_session();
  if not private.has_any_role(array['superadmin']::identity.app_role[]) then
    raise exception 'solo la dirección quita dominios institucionales' using errcode = '42501';
  end if;
  delete from identity.institutional_domains where domain = v_domain;
  if not found then
    raise exception 'ese dominio no está en la lista' using errcode = 'P0002';
  end if;
  perform private.write_audit('institutional_domain.removed', 'institutional_domain', v_domain);
end $$;

revoke all on function public.list_institutional_domains(), public.add_institutional_domain(text), public.remove_institutional_domain(text) from public, anon;
grant execute on function public.list_institutional_domains(), public.add_institutional_domain(text), public.remove_institutional_domain(text) to authenticated;

-- 3. Invitaciones ------------------------------------------------------------------------------------------------------
alter table identity.invitations drop constraint invitations_role_check;
alter table identity.invitations add constraint invitations_role_check
  check (role in ('admin', 'cajero', 'coordinador', 'repartidor', 'comercio'));
alter table identity.invitations add column commerce_id uuid references identity.commerces(id);
alter table identity.invitations add constraint invitations_commerce_role
  check ((role = 'comercio') = (commerce_id is not null));
grant select (commerce_id) on identity.invitations to authenticated;

-- El equipo: solo correos institucionales y nunca una cuenta de la tienda o del repartidor.
create or replace function public.create_invitation(p_email text, p_role identity.app_role, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
  v_prev uuid;
  v_exp timestamptz := now() + interval '4 days';
begin
  perform private.require_console_session();
  if p_role not in ('admin', 'cajero', 'coordinador') then
    raise exception 'ese rol no se asigna por invitación' using errcode = '22023';
  end if;
  if not private.can_manage(p_role) then
    raise exception 'no tienes permiso para invitar al rol %', p_role using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'correo inválido' using errcode = '22023';
  end if;
  if not private.is_institutional_email(v_email) then
    raise exception 'usa un correo institucional: el dominio @% no está en la lista de la dirección', split_part(v_email, '@', 2)
      using errcode = '22023';
  end if;
  if private.email_app(v_email) is distinct from null and private.email_app(v_email) <> 'consola' then
    raise exception 'ese correo ya es una cuenta de la tienda o del repartidor; invita otro correo' using errcode = '23505';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash de token inválido' using errcode = '22023';
  end if;
  if exists (
    select 1 from identity.profile_pii pii
    join identity.user_roles ur on ur.user_id = pii.user_id
    where lower(pii.email) = v_email and ur.role = p_role and ur.status <> 'revocado'
  ) then
    raise exception 'esa persona ya tiene el rol %', p_role using errcode = '23505';
  end if;

  update identity.invitations set status = 'cancelada'
   where lower(email) = v_email and role = p_role and status = 'pendiente'
  returning id into v_prev;

  insert into identity.invitations (email, role, invited_by, token_hash, expires_at)
  values (v_email, p_role, auth.uid(), p_token_hash, v_exp)
  returning id into v_id;

  perform private.write_audit('invitation.created', 'invitation', v_id::text, null,
    jsonb_build_object('role', p_role, 'replaced', v_prev));
  return jsonb_build_object('id', v_id, 'expires_at', v_exp);
end $$;

-- El repartidor: nunca una cuenta de la tienda o de la consola. Igual que antes, más esa regla.
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
  if private.email_app(v_email) is distinct from null and private.email_app(v_email) <> 'repartidor' then
    raise exception 'ese correo ya es una cuenta de la tienda o de la consola; invita otro correo' using errcode = '23505';
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

-- El comercio: su cuenta de consola nace de una invitación a un correo propio, distinto del de la tienda.
create or replace function private.invite_commerce_account(p_commerce uuid, p_email text, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
  v_prev uuid;
  v_exp timestamptz := now() + interval '4 days';
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'el correo para la consola no es válido' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash de token inválido' using errcode = '22023';
  end if;
  if private.email_app(v_email) is not null then
    raise exception 'ese correo ya tiene una cuenta en Rapitrip; el comercio necesita un correo nuevo para la consola'
      using errcode = '23505';
  end if;
  if exists (select 1 from identity.user_roles where commerce_id = p_commerce and role = 'comercio' and status <> 'revocado') then
    raise exception 'ese comercio ya tiene su cuenta de consola' using errcode = '23505';
  end if;

  update identity.invitations set status = 'cancelada'
   where commerce_id = p_commerce and status = 'pendiente'
  returning id into v_prev;
  update identity.invitations set status = 'cancelada'
   where lower(email) = v_email and role = 'comercio' and status = 'pendiente';

  insert into identity.invitations (email, role, commerce_id, invited_by, token_hash, expires_at)
  values (v_email, 'comercio', p_commerce, auth.uid(), p_token_hash, v_exp)
  returning id into v_id;

  perform private.write_audit('invitation.created', 'invitation', v_id::text, null,
    jsonb_build_object('role', 'comercio', 'commerce_id', p_commerce, 'replaced', v_prev));
  return jsonb_build_object('id', v_id, 'expires_at', v_exp, 'email', v_email);
end $$;

-- Invitar (o volver a invitar) la cuenta de consola de un comercio ya aprobado, desde su ficha.
create or replace function public.create_commerce_invitation(p_commerce uuid, p_email text, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_console_session();
  if not private.has_any_role(array['admin', 'superadmin']::identity.app_role[]) or not private.can_manage('comercio') then
    raise exception 'no tienes permiso para invitar comercios' using errcode = '42501';
  end if;
  if not exists (select 1 from identity.commerces where id = p_commerce) then
    raise exception 'comercio inexistente' using errcode = 'P0002';
  end if;
  return private.invite_commerce_account(p_commerce, p_email, p_token_hash);
end $$;

revoke all on function public.create_commerce_invitation(uuid, text, text) from public, anon;
grant execute on function public.create_commerce_invitation(uuid, text, text) to authenticated;

-- 4. Solicitudes de afiliación -------------------------------------------------------------------------------------------
-- La solicitud trae el correo con el que el comercio entrará a la consola: distinto del de su cuenta de la tienda.
create or replace function public.submit_commerce_request(p_business_name text, p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(p_business_name);
  v_details jsonb := p_details;
  v_kind text;
  v_ruc text;
  v_console text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  perform private.require_valid_session();
  if not exists (select 1 from identity.profiles where id = auth.uid() and status = 'activa' and app = 'tienda') then
    raise exception 'la afiliación se solicita desde una cuenta de la tienda' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    raise exception 'confirma tu correo antes de solicitar la afiliación' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 150 then
    raise exception 'el nombre del negocio debe tener entre 2 y 150 caracteres' using errcode = '22023';
  end if;
  if v_details is null or jsonb_typeof(v_details) <> 'object' then
    raise exception 'los datos del negocio deben ser un objeto' using errcode = '22023';
  end if;

  v_console := lower(btrim(coalesce(v_details ->> 'console_email', '')));
  if v_console !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'escribe el correo con el que el negocio entrará a la consola' using errcode = '22023';
  end if;
  if v_console = (select lower(email) from identity.profile_pii where user_id = auth.uid()) then
    raise exception 'el correo de la consola debe ser distinto del de tu cuenta de la tienda' using errcode = '22023';
  end if;

  v_kind := coalesce(nullif(btrim(v_details ->> 'business_kind'), ''), 'informal');
  if v_kind not in ('informal', 'empresa') then
    raise exception 'el tipo de comercio debe ser informal o empresa' using errcode = '22023';
  end if;
  if v_kind = 'empresa' then
    v_ruc := private.normalize_ruc(v_details ->> 'ruc');
    if v_ruc !~ '^[A-Z0-9]{8,20}$' then
      raise exception 'el RUC debe tener entre 8 y 20 letras o números' using errcode = '22023';
    end if;
    if exists (select 1 from identity.commerces where ruc = v_ruc)
       or exists (select 1 from identity.commerce_requests where status = 'pendiente' and details ->> 'ruc' = v_ruc) then
      raise exception 'ya existe un comercio o una solicitud con ese RUC' using errcode = '23505';
    end if;
    v_details := v_details || jsonb_build_object('business_kind', 'empresa', 'ruc', v_ruc);
  else
    v_details := (v_details - 'ruc') || jsonb_build_object('business_kind', 'informal');
  end if;
  v_details := v_details || jsonb_build_object('console_email', v_console);

  begin
    insert into identity.commerce_requests (requester_id, business_name, details)
    values (auth.uid(), v_name, v_details)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya tienes una solicitud pendiente' using errcode = '23505';
  end;

  perform private.write_audit('commerce_request.submitted', 'commerce_request', v_id::text);
  return v_id;
end $$;

-- Aprobar crea el comercio y la invitación a su cuenta de consola; la cuenta de la tienda no recibe ningún rol.
-- `p_console_email` permite corregir el correo (o ponerlo en solicitudes de antes de este cambio).
drop function public.approve_commerce_request(uuid, boolean);
create or replace function public.approve_commerce_request(
  p_request uuid, p_convenio_confirmed boolean, p_token_hash text, p_console_email text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v identity.commerce_requests;
  v_commerce uuid;
  v_email text;
  v_kind text;
  v_ruc text;
  v_console text;
  v_invitation jsonb;
begin
  perform private.require_console_session();
  if not private.has_any_role(array['admin', 'superadmin']::identity.app_role[])
     or not private.can_manage('comercio') then
    raise exception 'no tienes permiso para aprobar comercios' using errcode = '42501';
  end if;
  if p_convenio_confirmed is not true then
    raise exception 'confirma que el convenio de afiliación está firmado' using errcode = '22023';
  end if;

  select * into v from identity.commerce_requests where id = p_request for update;
  if not found then
    raise exception 'solicitud inexistente' using errcode = 'P0002';
  end if;
  if v.requester_id = auth.uid() then
    raise exception 'no puedes resolver tu propia solicitud' using errcode = '42501';
  end if;
  if v.status <> 'pendiente' then
    raise exception 'la solicitud ya fue resuelta' using errcode = '22023';
  end if;
  v_console := lower(btrim(coalesce(nullif(btrim(p_console_email), ''), v.details ->> 'console_email', '')));
  if v_console = '' then
    raise exception 'la solicitud no trae el correo para la consola: escríbelo para aprobarla' using errcode = '22023';
  end if;

  v_kind := case when v.details ->> 'business_kind' = 'empresa' then 'empresa' else 'informal' end;
  v_ruc := case when v_kind = 'empresa' then private.normalize_ruc(v.details ->> 'ruc') end;
  if v_kind = 'empresa' and (v_ruc is null or v_ruc !~ '^[A-Z0-9]{8,20}$') then
    raise exception 'la solicitud de empresa no trae un RUC válido' using errcode = '22023';
  end if;
  begin
    insert into identity.commerces (name, kind, ruc) values (v.business_name, v_kind, v_ruc) returning id into v_commerce;
  exception when unique_violation then
    raise exception 'ya existe un comercio con ese RUC' using errcode = '23505';
  end;
  v_invitation := private.invite_commerce_account(v_commerce, v_console, p_token_hash);

  update identity.commerce_requests
     set status = 'aprobada', reviewed_by = auth.uid(), reviewed_at = now(), commerce_id = v_commerce,
         details = details || jsonb_build_object('console_email', v_console)
   where id = p_request;

  select email into v_email from identity.profile_pii where user_id = v.requester_id;
  if v_email is not null then
    perform private.enqueue_email(v_email, 'commerce_approved',
      jsonb_build_object('business_name', v.business_name, 'console_email', v_console));
  end if;

  perform private.write_audit('commerce_request.approved', 'commerce_request', p_request::text, null,
    jsonb_build_object('commerce_id', v_commerce, 'requester_id', v.requester_id, 'kind', v_kind,
                       'invitation_id', v_invitation ->> 'id'));
  return v_invitation || jsonb_build_object('commerce_id', v_commerce);
end $$;

revoke all on function public.approve_commerce_request(uuid, boolean, text, text) from public, anon;
grant execute on function public.approve_commerce_request(uuid, boolean, text, text) to authenticated;

-- 5. Aceptar: la cuenta debe ser de la app del rol; el equipo, además, con correo institucional ----------------------
create or replace function public.finish_accept_invitation(p_token_hash text, p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v identity.invitations;
begin
  select * into v from identity.invitations where token_hash = p_token_hash for update;
  if not found or v.status <> 'pendiente' or v.expires_at <= now() then
    return false;
  end if;
  -- La cuenta debe ser la del correo invitado y de la app del rol.
  if not exists (select 1 from identity.profile_pii where user_id = p_user and lower(email) = lower(v.email)) then
    return false;
  end if;
  if not exists (select 1 from identity.profiles where id = p_user and app = private.role_app(v.role)) then
    return false;
  end if;
  if v.role in ('admin', 'cajero', 'coordinador') and not private.is_institutional_email(v.email) then
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
  if v.role = 'comercio' then
    if exists (select 1 from identity.user_roles where commerce_id = v.commerce_id and role = 'comercio' and status <> 'revocado')
       or exists (select 1 from identity.user_roles where user_id = p_user and status <> 'revocado') then
      return false;
    end if;
  end if;
  perform private.grant_role(p_user, v.role, v.commerce_id, v.invited_by);
  update identity.invitations
     set status = 'aceptada', accepted_at = now(), accepted_by = p_user
   where id = v.id;
  perform private.write_audit('invitation.accepted', 'invitation', v.id::text, null,
    jsonb_build_object('role', v.role, 'user_id', p_user));
  return true;
end $$;

-- La Edge Function accept-invitation necesita saber la app de la cuenta que ya existe.
create or replace function public.lookup_auth_user(p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
        'id', u.id,
        'email_confirmed', u.email_confirmed_at is not null,
        'has_password', exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'),
        'app', (select p.app from identity.profiles p where p.id = u.id))
     from auth.users u
     where lower(u.email) = lower(btrim(p_email))
     limit 1),
    'null'::jsonb);
$$;

-- El primer superadmin se siembra sobre una cuenta creada para la consola.
create or replace function public.bootstrap_superadmin(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from identity.profiles where id = p_user) then
    raise exception 'usuario inexistente' using errcode = 'P0002';
  end if;
  if not exists (select 1 from identity.profiles where id = p_user and app = 'consola') then
    raise exception 'el superadmin necesita una cuenta de consola (créala con app_metadata.rapitrip_app = "consola")'
      using errcode = '42501';
  end if;
  perform private.grant_role(p_user, 'superadmin', null, null);
end $$;

-- La ficha del comercio muestra la invitación pendiente de su cuenta de consola.
create or replace view public.invitations_list with (security_invoker = true) as
  select id, email, role, invited_by, status, expires_at, created_at, accepted_at, commerce_id
  from identity.invitations;
