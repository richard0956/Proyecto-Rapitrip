-- Tipo de comercio: vendedor propio / informal (el caso de siempre) o empresa con RUC.
-- Quien pide afiliarse elige el tipo; si es empresa debe indicar su RUC. Al aprobar, el comercio nace con su tipo y su RUC.
-- El tipo se muestra en el catálogo público (insignia «Empresa»); el RUC nunca sale de la base de datos hacia el público.

alter table identity.commerces
  add column kind text not null default 'informal' check (kind in ('informal', 'empresa')),
  add column ruc text check (ruc is null or ruc ~ '^[A-Z0-9]{8,20}$'),
  add constraint commerces_ruc_by_kind check ((kind = 'empresa') = (ruc is not null));

-- Un RUC pertenece a un solo comercio.
create unique index commerces_ruc_unique on identity.commerces (ruc) where ruc is not null;

-- Normaliza un RUC escrito por una persona: sin espacios ni guiones y en mayúsculas.
create or replace function private.normalize_ruc(p_ruc text)
returns text language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_ruc, ''), '[\s.-]', '', 'g'));
$$;

-- La solicitud acepta `business_kind` ('informal' por omisión o 'empresa') y, para empresas, `ruc` (8 a 20 letras o números).
-- Los datos se guardan ya normalizados dentro de `details`.
create or replace function public.submit_commerce_request(p_business_name text, p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(p_business_name);
  v_details jsonb := p_details;
  v_kind text;
  v_ruc text;
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
  if v_details is null or jsonb_typeof(v_details) <> 'object' then
    raise exception 'los datos del negocio deben ser un objeto' using errcode = '22023';
  end if;
  if exists (select 1 from identity.user_roles
             where user_id = auth.uid() and role = 'comercio' and status <> 'revocado') then
    raise exception 'tu cuenta ya tiene un comercio' using errcode = '23505';
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

-- Al aprobar, el comercio nace con el tipo y el RUC de la solicitud.
create or replace function public.approve_commerce_request(p_request uuid, p_convenio_confirmed boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v identity.commerce_requests;
  v_commerce uuid;
  v_email text;
  v_kind text;
  v_ruc text;
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
  if exists (select 1 from identity.user_roles
             where user_id = v.requester_id and role = 'comercio' and status <> 'revocado') then
    raise exception 'la cuenta solicitante ya tiene un comercio' using errcode = '23505';
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
  perform private.grant_role(v.requester_id, 'comercio', v_commerce, auth.uid());
  update identity.commerce_requests
     set status = 'aprobada', reviewed_by = auth.uid(), reviewed_at = now(), commerce_id = v_commerce
   where id = p_request;

  select email into v_email from identity.profile_pii where user_id = v.requester_id;
  if v_email is not null then
    perform private.enqueue_email(v_email, 'commerce_approved', jsonb_build_object('business_name', v.business_name));
  end if;

  perform private.write_audit('commerce_request.approved', 'commerce_request', p_request::text, null,
    jsonb_build_object('commerce_id', v_commerce, 'requester_id', v.requester_id, 'kind', v_kind));
  return v_commerce;
end $$;

-- La lista de comercios de la consola muestra el tipo y el RUC (solo administración la lee).
create or replace view public.commerces_list with (security_invoker = true) as
  select id, name, status, created_at, kind, ruc from identity.commerces;
