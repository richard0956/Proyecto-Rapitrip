-- Bucket privado para documentos de identidad de repartidores
insert into storage.buckets (id, name, public)
values ('courier-documents', 'courier-documents', false)
on conflict (id) do nothing;

create policy courier_documents_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'courier-documents' and private.is_admin_console());

create or replace function private.require_admin_console()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_console_session();
  if not private.has_any_role(array['admin', 'superadmin']::identity.app_role[]) then
    raise exception 'acción reservada al administrador' using errcode = '42501';
  end if;
end $$;

create or replace function private.validate_courier(p_name text, p_phone text, p_vehicle text, p_doc text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
    raise exception 'el nombre debe tener entre 2 y 120 caracteres' using errcode = '22023';
  end if;
  if p_phone is null or p_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'teléfono inválido' using errcode = '22023';
  end if;
  if p_vehicle is null or char_length(btrim(p_vehicle)) not between 2 and 60 then
    raise exception 'el tipo de vehículo debe tener entre 2 y 60 caracteres' using errcode = '22023';
  end if;
  -- Postgres limita las repeticiones de una expresión regular a 255, por eso el largo se valida aparte.
  if p_doc is not null and (p_doc !~ '^[A-Za-z0-9/_.-]+$' or char_length(p_doc) > 300) then
    raise exception 'ruta de documento inválida' using errcode = '22023';
  end if;
end $$;

create or replace function public.create_courier(
  p_full_name text, p_phone text, p_vehicle_type text, p_document_path text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_admin_console();
  perform private.validate_courier(p_full_name, p_phone, p_vehicle_type, p_document_path);
  insert into identity.couriers (full_name, phone, vehicle_type, document_path, created_by)
  values (btrim(p_full_name), p_phone, btrim(p_vehicle_type), p_document_path, auth.uid())
  returning id into v_id;
  perform private.write_audit('courier.created', 'courier', v_id::text);
  return v_id;
end $$;

create or replace function public.update_courier(
  p_id uuid, p_full_name text, p_phone text, p_vehicle_type text, p_document_path text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old identity.couriers;
  v_changed text[] := '{}';
begin
  perform private.require_admin_console();
  perform private.validate_courier(p_full_name, p_phone, p_vehicle_type, p_document_path);
  select * into v_old from identity.couriers where id = p_id for update;
  if not found then
    raise exception 'repartidor inexistente' using errcode = 'P0002';
  end if;

  if v_old.full_name is distinct from btrim(p_full_name) then v_changed := array_append(v_changed, 'full_name'); end if;
  if v_old.phone is distinct from p_phone then v_changed := array_append(v_changed, 'phone'); end if;
  if v_old.vehicle_type is distinct from btrim(p_vehicle_type) then v_changed := array_append(v_changed, 'vehicle_type'); end if;
  if p_document_path is not null and v_old.document_path is distinct from p_document_path then
    v_changed := array_append(v_changed, 'document');
  end if;

  update identity.couriers
     set full_name = btrim(p_full_name), phone = p_phone, vehicle_type = btrim(p_vehicle_type),
         document_path = coalesce(p_document_path, document_path), updated_at = now()
   where id = p_id;

  if array_length(v_changed, 1) > 0 then
    perform private.write_audit('courier.updated', 'courier', p_id::text, null,
      jsonb_build_object('changed_fields', to_jsonb(v_changed)));
  end if;
end $$;

create or replace function public.set_courier_status(p_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform private.require_admin_console();
  if p_status not in ('activo', 'inactivo') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'el motivo es obligatorio (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  select status into v_old from identity.couriers where id = p_id for update;
  if not found then
    raise exception 'repartidor inexistente' using errcode = 'P0002';
  end if;
  update identity.couriers set status = p_status, updated_at = now() where id = p_id;
  perform private.write_audit('courier.status_changed', 'courier', p_id::text,
    jsonb_build_object('status', v_old), jsonb_build_object('status', p_status), btrim(p_reason));
end $$;

create or replace function public.read_courier_document(p_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare v_path text;
begin
  perform private.require_admin_console();
  select document_path into v_path from identity.couriers where id = p_id;
  if not found or v_path is null then
    raise exception 'el repartidor no tiene documento' using errcode = 'P0002';
  end if;
  perform private.write_audit('read_sensitive', 'courier', p_id::text, null, null, null,
    jsonb_build_object('resource', 'courier_document'));
  return v_path;
end $$;

create or replace function public.get_client_detail(p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_detail jsonb;
begin
  perform private.require_admin_console();
  select jsonb_build_object('id', p.id, 'full_name', pii.full_name, 'email', pii.email,
                            'phone', pii.phone, 'status', p.status, 'created_at', p.created_at)
    into v_detail
  from identity.profiles p
  join identity.profile_pii pii on pii.user_id = p.id
  where p.id = p_user;
  if v_detail is null then
    raise exception 'cuenta inexistente' using errcode = 'P0002';
  end if;
  perform private.write_audit('read_sensitive', 'profile', p_user::text, null, null, null,
    jsonb_build_object('resource', 'client_detail'));
  return v_detail;
end $$;

revoke all on function public.create_courier(text, text, text, text) from public, anon;
revoke all on function public.update_courier(uuid, text, text, text, text) from public, anon;
revoke all on function public.set_courier_status(uuid, text, text) from public, anon;
revoke all on function public.read_courier_document(uuid) from public, anon;
revoke all on function public.get_client_detail(uuid) from public, anon;
grant execute on function public.create_courier(text, text, text, text) to authenticated;
grant execute on function public.update_courier(uuid, text, text, text, text) to authenticated;
grant execute on function public.set_courier_status(uuid, text, text) to authenticated;
grant execute on function public.read_courier_document(uuid) to authenticated;
grant execute on function public.get_client_detail(uuid) to authenticated;