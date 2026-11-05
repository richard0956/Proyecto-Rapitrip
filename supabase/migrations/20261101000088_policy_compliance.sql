-- Cumplimiento del Manual de Políticas de TI (primer bloque).
--   Norma 6.2.1   el comercio confirma un pedido express en un máximo de 15 minutos.
--   Control 6.1.1 coordinación ve los pedidos sin avance de estado por más de 30 minutos.
--   Norma 7.1     la foto y la confirmación (código) de la entrega son siempre obligatorias.
--   Norma 1.3.2   un incidente de seguridad indica la fecha, la información involucrada y las personas afectadas.
--   Norma 2.3.3   no se inhabilita a un repartidor ni se suspende a un comercio con pedidos abiertos sin resolverlos antes.

-- 1. Confirmación del comercio en 15 minutos ---------------------------------------------------------------------------
-- Las funciones que crean y cobran pedidos fijan su propio vencimiento; esta regla lo acota en un solo lugar. Solo toca a
-- los express que esperan al comercio: el programado conserva sus 24 horas y el pago con tarjeta, su ventana para pagar.
create or replace function private.merchant_confirm_window()
returns interval language sql immutable set search_path = '' as $$ select interval '15 minutes' $$;

create or replace function private.cap_confirmation_deadline()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'por_confirmar' and new.delivery_class = 'express' and new.expires_at is not null
     and (tg_op = 'INSERT' or new.expires_at is distinct from old.expires_at or new.status is distinct from old.status) then
    new.expires_at := least(new.expires_at, now() + private.merchant_confirm_window());
  end if;
  return new;
end $$;

create trigger orders_confirmation_deadline
  before insert or update of expires_at, status on sales.orders
  for each row execute function private.cap_confirmation_deadline();

-- Los que ya esperan, también: ninguno espera más de 15 minutos desde ahora.
update sales.orders set expires_at = least(expires_at, now() + private.merchant_confirm_window())
 where status = 'por_confirmar' and delivery_class = 'express' and expires_at is not null;

-- 2. Pedidos sin avance de estado ----------------------------------------------------------------------------------------
create or replace function private.stalled_after()
returns interval language sql immutable set search_path = '' as $$ select interval '30 minutes' $$;

-- Pedidos en preparación (confirmado o preparando) cuyo último cambio de estado tiene más de 30 minutos. Solo para la
-- operación (coordinación, caja y administración); para cualquier otro, vacío.
create or replace function public.stalled_orders()
returns table (id uuid, number text, store_name text, status text, since timestamptz, minutes int)
language sql stable security definer set search_path = '' as $$
  with last_change as (
    select o.id, o.number, o.store_name, o.status,
           coalesce((select max(e.created_at) from sales.order_events e where e.order_id = o.id), o.updated_at) as since
      from sales.orders o
     where o.status in ('confirmado', 'preparando')
  )
  select l.id, l.number::text, l.store_name, l.status, l.since, floor(extract(epoch from now() - l.since) / 60)::int
    from last_change l
   where private.is_ops_console() and l.since < now() - private.stalled_after()
   order by l.since
   limit 50;
$$;

revoke all on function public.stalled_orders() from public, anon;
grant execute on function public.stalled_orders() to authenticated;

-- 3. Foto y código de entrega obligatorios -------------------------------------------------------------------------------
update sales.evidence_settings set require_delivery_photo = true, require_delivery_code = true;
alter table sales.evidence_settings
  add constraint evidence_delivery_required check (require_delivery_photo and require_delivery_code);

create or replace function public.set_evidence_settings(
  p_pickup_photo boolean, p_delivery_photo boolean, p_pickup_code boolean, p_delivery_code boolean,
  p_alert_distance_m int, p_retention_days int
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  if p_pickup_photo is null or p_delivery_photo is null or p_pickup_code is null or p_delivery_code is null then
    raise exception 'indica cada regla' using errcode = '22023';
  end if;
  if p_delivery_photo is not true or p_delivery_code is not true then
    raise exception 'la foto y el código de entrega son obligatorios (Norma 7.1 del manual de políticas de TI)' using errcode = '22023';
  end if;
  if p_alert_distance_m is null or p_alert_distance_m not between 20 and 2000 then
    raise exception 'la distancia de alerta debe estar entre 20 y 2000 metros' using errcode = '22023';
  end if;
  if p_retention_days is null or p_retention_days not between 7 and 365 then
    raise exception 'la conservación debe estar entre 7 y 365 días' using errcode = '22023';
  end if;
  update sales.evidence_settings set
    require_pickup_photo = p_pickup_photo, require_delivery_photo = true,
    require_pickup_code = p_pickup_code, require_delivery_code = true,
    alert_distance_m = p_alert_distance_m, retention_days = p_retention_days, updated_at = now();
  perform private.write_audit('evidence.settings_changed', 'evidence_settings', 'main', null,
    jsonb_build_object('pickup_photo', p_pickup_photo, 'delivery_photo', true, 'pickup_code', p_pickup_code,
                       'delivery_code', true, 'alert_distance_m', p_alert_distance_m, 'retention_days', p_retention_days));
end $$;

-- 4. Incidentes con la información que pide el manual --------------------------------------------------------------------
-- Comprueba y arma los datos de un incidente de seguridad: fecha en que ocurrió (no en el futuro), qué información y a
-- quiénes afecta. En un incidente de interrupción son opcionales.
create or replace function private.incident_details(
  p_type audit.incident_type, p_occurred_at timestamptz, p_data_involved text, p_affected text
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_data text := nullif(left(btrim(coalesce(p_data_involved, '')), 300), '');
  v_affected text := nullif(left(btrim(coalesce(p_affected, '')), 300), '');
begin
  if p_occurred_at is not null and p_occurred_at > now() + interval '5 minutes' then
    raise exception 'la fecha del incidente no puede ser futura' using errcode = '22023';
  end if;
  if p_type = 'seguridad' and (v_data is null or v_affected is null) then
    raise exception 'en un incidente de seguridad indica qué información está involucrada y quiénes están afectados'
      using errcode = '22023';
  end if;
  return jsonb_strip_nulls(jsonb_build_object('occurred_at', p_occurred_at, 'data_involved', v_data, 'affected', v_affected));
end $$;

drop function public.staff_report_incident(audit.incident_type, audit.incident_severity, text, text);
create or replace function public.staff_report_incident(
  p_type audit.incident_type,
  p_severity audit.incident_severity,
  p_description text,
  p_where text default null,
  p_occurred_at timestamptz default null,
  p_data_involved text default null,
  p_affected text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_source text;
  v_name text;
  v_details jsonb;
begin
  perform private.require_console_session();
  v_source := case
    when private.has_any_role(array['cajero']::identity.app_role[]) then 'caja'
    when private.has_any_role(array['coordinador']::identity.app_role[]) then 'coordinacion'
    when private.has_any_role(array['comercio']::identity.app_role[]) then 'comercio'
  end;
  if v_source is null then
    raise exception 'no tienes permiso para reportar incidentes desde aquí' using errcode = '42501';
  end if;
  if p_type is null or p_severity is null then
    raise exception 'elige el tipo y la gravedad del incidente' using errcode = '22023';
  end if;
  if p_description is null or char_length(btrim(p_description)) not between 10 and 2000 then
    raise exception 'describe el incidente con al menos 10 caracteres' using errcode = '22023';
  end if;
  v_details := private.incident_details(p_type, p_occurred_at, p_data_involved, p_affected);
  if (select count(*) from audit.it_incidents
       where reported_by = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'ya enviaste varios reportes hoy; si es urgente, llama a la administración' using errcode = '22023';
  end if;

  select nullif(btrim(full_name), '') into v_name from identity.profile_pii where user_id = auth.uid();

  insert into audit.it_incidents (type, origin, severity, description, reported_by, metadata)
  values (p_type, 'manual', p_severity, btrim(p_description), auth.uid(),
          jsonb_strip_nulls(jsonb_build_object(
            'source', v_source,
            'reporter', v_name,
            'where', nullif(left(btrim(coalesce(p_where, '')), 80), ''))) || v_details)
  returning id into v_id;
  perform private.write_audit('incident.created', 'it_incident', v_id::text, null,
    jsonb_build_object('origin', 'manual', 'source', v_source, 'severity', p_severity));
  perform private.notify_incident(v_id);
  return v_id;
end $$;

revoke all on function public.staff_report_incident(audit.incident_type, audit.incident_severity, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.staff_report_incident(audit.incident_type, audit.incident_severity, text, text, timestamptz, text, text) to authenticated;

drop function public.courier_report_incident(audit.incident_type, audit.incident_severity, text, text, text);
create or replace function public.courier_report_incident(
  p_type audit.incident_type,
  p_severity audit.incident_severity,
  p_description text,
  p_where text default null,
  p_device text default null,
  p_occurred_at timestamptz default null,
  p_data_involved text default null,
  p_affected text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_courier uuid;
  v_details jsonb;
begin
  if not private.is_courier_session() then
    raise exception 'no tienes permiso para reportar incidentes' using errcode = '42501';
  end if;
  v_courier := private.current_courier_id();
  if p_type is null or p_severity is null then
    raise exception 'elige el tipo y la gravedad del incidente' using errcode = '22023';
  end if;
  if p_description is null or char_length(btrim(p_description)) not between 10 and 2000 then
    raise exception 'describe el incidente con al menos 10 caracteres' using errcode = '22023';
  end if;
  v_details := private.incident_details(p_type, p_occurred_at, p_data_involved, p_affected);
  if (select count(*) from audit.it_incidents
       where reported_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'ya enviaste varios reportes hoy; si es urgente, avisa a coordinación' using errcode = '22023';
  end if;

  insert into audit.it_incidents (type, origin, severity, description, reported_by, metadata)
  values (p_type, 'manual', p_severity, btrim(p_description), auth.uid(),
          jsonb_strip_nulls(jsonb_build_object(
            'source', 'repartidor',
            'courier_id', v_courier,
            'where', nullif(left(btrim(coalesce(p_where, '')), 80), ''),
            'device', nullif(left(btrim(coalesce(p_device, '')), 300), ''))) || v_details)
  returning id into v_id;
  perform private.write_audit('incident.created', 'it_incident', v_id::text, null,
    jsonb_build_object('origin', 'manual', 'source', 'repartidor', 'severity', p_severity));
  perform private.notify_incident(v_id);
  return v_id;
end $$;

revoke all on function public.courier_report_incident(audit.incident_type, audit.incident_severity, text, text, text, timestamptz, text, text) from public, anon;
grant execute on function public.courier_report_incident(audit.incident_type, audit.incident_severity, text, text, text, timestamptz, text, text) to authenticated;

-- La lista de la administración muestra esos datos.
create or replace view public.it_incidents_list with (security_invoker = true) as
  select id, type, origin, severity, description, status, resolution, created_at, resolved_at,
         metadata ->> 'source' as source,
         metadata ->> 'where' as reported_from,
         metadata ->> 'reporter' as reporter_name,
         (metadata ->> 'occurred_at')::timestamptz as occurred_at,
         metadata ->> 'data_involved' as data_involved,
         metadata ->> 'affected' as affected
  from audit.it_incidents;

-- 5. Inhabilitar sin dejar pedidos colgados ------------------------------------------------------------------------------
create or replace function private.open_order_statuses()
returns text[] language sql immutable set search_path = '' as $$
  select array['pendiente_pago', 'por_confirmar', 'en_validacion', 'confirmado', 'preparando', 'listo', 'en_camino'];
$$;

-- Repartidor: sus pedidos abiertos se reasignan antes de desactivarlo o de revocar su cuenta.
create or replace function private.assert_courier_without_open_orders(p_courier uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare v_count int;
begin
  select count(*) into v_count from sales.orders where courier_id = p_courier and status = any (private.open_order_statuses());
  if v_count > 0 then
    raise exception 'el repartidor tiene % pedido(s) abierto(s): reasígnalos o ciérralos antes de inhabilitarlo', v_count
      using errcode = '22023';
  end if;
end $$;

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
  if p_status = 'inactivo' then
    perform private.assert_courier_without_open_orders(p_id);
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
  perform private.assert_courier_without_open_orders(p_courier);
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

-- Comercio: sus pedidos abiertos se resuelven antes de suspenderlo.
create or replace function public.set_commerce_status(p_commerce uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
  v_open int;
begin
  perform private.require_admin_console();
  if not private.can_manage('comercio') then
    raise exception 'no tienes permiso para gestionar comercios' using errcode = '42501';
  end if;
  if p_status not in ('activo', 'suspendido') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 or char_length(p_reason) > 500 then
    raise exception 'el motivo es obligatorio (entre 5 y 500 caracteres)' using errcode = '22023';
  end if;
  select status into v_old from identity.commerces where id = p_commerce for update;
  if not found then
    raise exception 'comercio no encontrado' using errcode = 'P0002';
  end if;
  if v_old = p_status then
    raise exception 'el comercio ya está en ese estado' using errcode = '22023';
  end if;
  if p_status = 'suspendido' then
    select count(*) into v_open
      from sales.orders o join commerce.stores s on s.id = o.store_id
     where s.commerce_id = p_commerce and o.status = any (private.open_order_statuses());
    if v_open > 0 then
      raise exception 'el comercio tiene % pedido(s) abierto(s): resuélvelos antes de suspenderlo', v_open using errcode = '22023';
    end if;
  end if;
  update identity.commerces set status = p_status where id = p_commerce;
  perform private.write_audit('commerce.status_changed', 'commerce', p_commerce::text, null,
    jsonb_build_object('status', p_status), p_reason);
end $$;
