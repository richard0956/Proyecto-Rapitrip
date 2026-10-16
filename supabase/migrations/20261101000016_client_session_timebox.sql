-- Tope de antigüedad de la sesión: nadie conserva una sesión de más de 1 día.
-- Supabase solo ofrece este límite (time-box) en el plan Pro; esta función lo aplica en la base.
-- Lee la fila de la sesión en auth.sessions: si el usuario cerró sesión, la fila ya no existe y la
-- sesión deja de valer de inmediato en las funciones que la exigen.
create or replace function private.has_valid_session()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_sid uuid;
begin
  if auth.uid() is null then return false; end if;
  begin
    v_sid := nullif(private.jwt_claims() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if v_sid is null then return false; end if;
  return exists (
    select 1 from auth.sessions s
    where s.id = v_sid
      and s.user_id = auth.uid()
      and s.created_at > now() - interval '1 day'
  );
end $$;

create or replace function private.require_valid_session()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_valid_session() then
    raise exception 'tu sesión venció: inicia sesión de nuevo' using errcode = '42501';
  end if;
end $$;

grant execute on function private.has_valid_session() to authenticated;

-- Vistas del propio usuario: solo con sesión vigente.
create or replace view public.my_profile with (security_invoker = true) as
  select p.id, p.status, p.created_at, p.last_sign_in_at, pii.full_name, pii.email, pii.phone
  from identity.profiles p
  join identity.profile_pii pii on pii.user_id = p.id
  where p.id = auth.uid() and private.has_valid_session();

create or replace view public.my_roles with (security_invoker = true) as
  select ur.id, ur.role, ur.commerce_id, ur.status, ur.granted_at
  from identity.user_roles ur
  where ur.user_id = auth.uid() and private.has_valid_session();

-- Funciones de cliente: se vuelven a crear con la comprobación al inicio.
create or replace function public.update_my_profile(p_full_name text, p_phone text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old identity.profile_pii;
  v_name text := btrim(p_full_name);
  v_changed text[] := '{}';
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  perform private.require_valid_session();
  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception 'el nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  if p_phone is not null and p_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'teléfono inválido' using errcode = '22023';
  end if;

  select * into v_old from identity.profile_pii where user_id = auth.uid() for update;
  if not found then
    raise exception 'perfil inexistente' using errcode = 'P0002';
  end if;

  if v_old.full_name is distinct from v_name then v_changed := array_append(v_changed, 'full_name'); end if;
  if v_old.phone is distinct from p_phone then v_changed := array_append(v_changed, 'phone'); end if;

  update identity.profile_pii
     set full_name = v_name, phone = p_phone, updated_at = now()
   where user_id = auth.uid();

  if array_length(v_changed, 1) > 0 then
    perform private.write_audit('profile.updated', 'profile', auth.uid()::text, null,
      jsonb_build_object('changed_fields', to_jsonb(v_changed)));
  end if;
end $$;

create or replace function public.submit_commerce_request(p_business_name text, p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(p_business_name);
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  perform private.require_valid_session();
  if not exists (select 1 from identity.profiles where id = auth.uid() and status = 'activa') then
    raise exception 'la cuenta no está activa' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null) then
    raise exception 'confirma tu correo antes de solicitar la afiliación' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 150 then
    raise exception 'el nombre del negocio debe tener entre 2 y 150 caracteres' using errcode = '22023';
  end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' then
    raise exception 'los datos del negocio deben ser un objeto' using errcode = '22023';
  end if;
  if exists (select 1 from identity.user_roles
             where user_id = auth.uid() and role = 'comercio' and status <> 'revocado') then
    raise exception 'tu cuenta ya tiene un comercio' using errcode = '23505';
  end if;

  begin
    insert into identity.commerce_requests (requester_id, business_name, details)
    values (auth.uid(), v_name, p_details)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya tienes una solicitud pendiente' using errcode = '23505';
  end;

  perform private.write_audit('commerce_request.submitted', 'commerce_request', v_id::text);
  return v_id;
end $$;