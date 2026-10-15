create or replace function public.submit_commerce_request(p_business_name text, p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(p_business_name);
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
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

create or replace function public.approve_commerce_request(p_request uuid, p_convenio_confirmed boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v identity.commerce_requests;
  v_commerce uuid;
  v_email text;
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

  insert into identity.commerces (name) values (v.business_name) returning id into v_commerce;
  perform private.grant_role(v.requester_id, 'comercio', v_commerce, auth.uid());
  update identity.commerce_requests
     set status = 'aprobada', reviewed_by = auth.uid(), reviewed_at = now(), commerce_id = v_commerce
   where id = p_request;

  select email into v_email from identity.profile_pii where user_id = v.requester_id;
  if v_email is not null then
    perform private.enqueue_email(v_email, 'commerce_approved', jsonb_build_object('business_name', v.business_name));
  end if;

  perform private.write_audit('commerce_request.approved', 'commerce_request', p_request::text, null,
    jsonb_build_object('commerce_id', v_commerce, 'requester_id', v.requester_id));
  return v_commerce;
end $$;

create or replace function public.reject_commerce_request(p_request uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v identity.commerce_requests;
  v_email text;
begin
  perform private.require_console_session();
  if not private.has_any_role(array['admin', 'superadmin']::identity.app_role[])
     or not private.can_manage('comercio') then
    raise exception 'no tienes permiso para rechazar solicitudes' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'el motivo es obligatorio (mínimo 10 caracteres)' using errcode = '22023';
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

  update identity.commerce_requests
     set status = 'rechazada', decision_reason = btrim(p_reason), reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_request;

  select email into v_email from identity.profile_pii where user_id = v.requester_id;
  if v_email is not null then
    perform private.enqueue_email(v_email, 'commerce_rejected',
      jsonb_build_object('business_name', v.business_name, 'reason', btrim(p_reason)));
  end if;

  perform private.write_audit('commerce_request.rejected', 'commerce_request', p_request::text, null,
    jsonb_build_object('requester_id', v.requester_id), btrim(p_reason));
end $$;

revoke all on function public.submit_commerce_request(text, jsonb) from public, anon;
revoke all on function public.approve_commerce_request(uuid, boolean) from public, anon;
revoke all on function public.reject_commerce_request(uuid, text) from public, anon;
grant execute on function public.submit_commerce_request(text, jsonb) to authenticated;
grant execute on function public.approve_commerce_request(uuid, boolean) to authenticated;
grant execute on function public.reject_commerce_request(uuid, text) to authenticated;