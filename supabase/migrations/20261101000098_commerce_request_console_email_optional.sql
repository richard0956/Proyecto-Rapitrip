-- La solicitud de afiliación ya no pide el correo de la consola: lo escribe un administrador al aprobarla
-- (`approve_commerce_request` ya acepta `p_console_email`, y la consola de solicitudes lo pide antes de aprobar).
-- Si el formulario o una prueba todavía lo manda, se sigue validando igual (formato y distinto del correo de la cuenta de la tienda).

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
  if v_console <> '' then
    if v_console !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'escribe un correo válido para la consola del negocio' using errcode = '22023';
    end if;
    if v_console = (select lower(email) from identity.profile_pii where user_id = auth.uid()) then
      raise exception 'el correo de la consola debe ser distinto del de tu cuenta de la tienda' using errcode = '22023';
    end if;
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
  v_details := case when v_console <> '' then v_details || jsonb_build_object('console_email', v_console) else v_details - 'console_email' end;

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
