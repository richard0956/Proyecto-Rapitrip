-- Repartidor, etapa 4: evidencias de la entrega.
-- Diseño: docs/informe/2026-10-23-repartidor-revision-evidencias-y-consolas.md (sección 2).
--
-- Cada pedido deja una cadena de evidencias desde que el comercio se lo entrega al repartidor hasta que éste lo entrega:
--   · recogida   : foto del paquete en la tienda + código de recogida que ve el comercio.
--   · entrega    : foto del paquete en el lugar + código de entrega que ve el cliente.
--   · fallida    : foto y motivo de un intento que no se pudo entregar.
--   · devolucion_tienda : foto al devolver a la tienda un pedido que no se entregó.
-- Esta migración crea los datos y las reglas de lectura; las acciones `courier_pick_up` y `courier_deliver` (etapa 5) exigirán
-- estas evidencias para avanzar el pedido.
--
--   * Las evidencias son de SOLO ADICIÓN y la hora la pone el servidor. Solo el mantenimiento (retención) las toca.
--   * Los códigos no se escriben nunca en la auditoría; cinco intentos fallidos los bloquean hasta que coordinación los libere.
--   * La ubicación se toma solo en el instante de la evidencia y solo sirve de alerta: nunca bloquea.
--   * Las fotos se conservan 90 días (decisión E6: 3 meses) y se eliminan con la función de borde `purge-evidence`.

-- Reglas ajustables por la administración ------------------------------------------------------------------------------

create table sales.evidence_settings (
  id boolean primary key default true check (id),
  require_pickup_photo boolean not null default true,
  require_delivery_photo boolean not null default true,
  require_pickup_code boolean not null default true,
  require_delivery_code boolean not null default true,
  alert_distance_m int not null default 150 check (alert_distance_m between 20 and 2000),
  retention_days int not null default 90 check (retention_days between 7 and 365),
  updated_at timestamptz not null default now()
);
insert into sales.evidence_settings default values;
alter table sales.evidence_settings enable row level security;
create policy evidence_settings_select on sales.evidence_settings
  for select to authenticated using (private.is_ops_console());
grant select on sales.evidence_settings to authenticated;

create or replace function public.set_evidence_settings(
  p_pickup_photo boolean, p_delivery_photo boolean, p_pickup_code boolean, p_delivery_code boolean,
  p_alert_distance_m int, p_retention_days int
) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  if p_pickup_photo is null or p_delivery_photo is null or p_pickup_code is null or p_delivery_code is null then
    raise exception 'indica cada regla' using errcode = '22023';
  end if;
  if p_alert_distance_m is null or p_alert_distance_m not between 20 and 2000 then
    raise exception 'la distancia de alerta debe estar entre 20 y 2000 metros' using errcode = '22023';
  end if;
  if p_retention_days is null or p_retention_days not between 7 and 365 then
    raise exception 'la conservación debe estar entre 7 y 365 días' using errcode = '22023';
  end if;
  update sales.evidence_settings set
    require_pickup_photo = p_pickup_photo, require_delivery_photo = p_delivery_photo,
    require_pickup_code = p_pickup_code, require_delivery_code = p_delivery_code,
    alert_distance_m = p_alert_distance_m, retention_days = p_retention_days, updated_at = now();
  perform private.write_audit('evidence.settings_changed', 'evidence_settings', 'main', null,
    jsonb_build_object('pickup_photo', p_pickup_photo, 'delivery_photo', p_delivery_photo, 'pickup_code', p_pickup_code,
                       'delivery_code', p_delivery_code, 'alert_distance_m', p_alert_distance_m, 'retention_days', p_retention_days));
end $$;

-- Códigos de recogida y de entrega ---------------------------------------------------------------------------------------
-- Sin acceso directo para nadie: se leen y se comprueban solo con las funciones de abajo.

create table sales.order_codes (
  order_id uuid primary key references sales.orders(id) on delete cascade,
  pickup_code text not null check (pickup_code ~ '^[0-9]{4}$'),
  delivery_code text not null check (delivery_code ~ '^[0-9]{4}$'),
  pickup_attempts int not null default 0,
  delivery_attempts int not null default 0,
  pickup_verified_at timestamptz,
  delivery_verified_at timestamptz,
  created_at timestamptz not null default now()
);
alter table sales.order_codes enable row level security;
revoke all on sales.order_codes from public, anon, authenticated;

-- Se generan cuando el pedido queda listo (idempotente).
create or replace function private.ensure_order_codes(p_order uuid)
returns void language sql security definer set search_path = '' as $$
  insert into sales.order_codes (order_id, pickup_code, delivery_code)
  values (p_order, lpad(floor(random() * 10000)::int::text, 4, '0'), lpad(floor(random() * 10000)::int::text, 4, '0'))
  on conflict (order_id) do nothing;
$$;
revoke all on function private.ensure_order_codes(uuid) from public, anon, authenticated;

-- Pedidos que ya estaban listos o en camino al estrenar esta migración.
insert into sales.order_codes (order_id, pickup_code, delivery_code)
select id, lpad(floor(random() * 10000)::int::text, 4, '0'), lpad(floor(random() * 10000)::int::text, 4, '0')
  from sales.orders where status in ('listo', 'en_camino')
on conflict (order_id) do nothing;

-- El núcleo de transiciones genera los códigos al pasar a «listo» (misma función de la migración 73 más esa línea).
create or replace function private.apply_order_transition(p_order sales.orders, p_to text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update sales.orders set
    status = p_to,
    status_reason = case when p_to in ('cancelado', 'rechazado') then p_reason else status_reason end,
    -- En validación el pedido tiene como plazo los días máximos de su entrega (mínimo uno); si nadie lo valida, vence.
    expires_at = case when p_to = 'en_validacion' then now() + make_interval(days => greatest(coalesce(p_order.eta_max_days, 1), 1)) else null end,
    updated_at = now(),
    confirmed_at = case when p_to = 'confirmado' then now() else confirmed_at end,
    delivered_at = case when p_to = 'entregado' then now() else delivered_at end,
    payment_status = case when p_to = 'entregado' and payment_method = 'efectivo' then 'pagado' else payment_status end
  where id = p_order.id;

  if p_to = 'listo' then
    perform private.ensure_order_codes(p_order.id);
  end if;
  if p_to in ('cancelado', 'rechazado') then
    perform private.release_order_stock(p_order.id, 'Pedido ' || p_order.number || ' ' || p_to);
  end if;
  insert into sales.order_events (order_id, from_status, to_status, reason, actor_id)
  values (p_order.id, p_order.status, p_to, p_reason, auth.uid());
  perform private.write_audit('order.' || p_to, 'order', p_order.id::text,
    jsonb_build_object('status', p_order.status), jsonb_build_object('status', p_to), p_reason);
end $$;
revoke all on function private.apply_order_transition(sales.orders, text, text) from public, anon, authenticated;

-- Comprueba un código escrito por el repartidor. Devuelve 'ok', 'incorrecto', 'bloqueado' (5 intentos fallidos: lo libera
-- coordinación) o 'sin_codigo' (pedido anterior a los códigos). Devuelve en vez de lanzar un error para que el intento fallido
-- quede contado: un error deshace lo guardado. Lo usan las acciones del repartidor (etapa 5); no es ejecutable desde la API.
create or replace function private.verify_order_code(p_order uuid, p_kind text, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v sales.order_codes;
  v_attempts int;
  v_expected text;
begin
  if p_kind not in ('recogida', 'entrega') then
    raise exception 'tipo de código no válido' using errcode = '22023';
  end if;
  select * into v from sales.order_codes where order_id = p_order for update;
  if not found then
    return 'sin_codigo';
  end if;
  v_attempts := case p_kind when 'recogida' then v.pickup_attempts else v.delivery_attempts end;
  v_expected := case p_kind when 'recogida' then v.pickup_code else v.delivery_code end;
  if v_attempts >= 5 then
    return 'bloqueado';
  end if;
  if p_code is not null and p_code = v_expected then
    if p_kind = 'recogida' then
      update sales.order_codes set pickup_verified_at = coalesce(pickup_verified_at, now()) where order_id = p_order;
    else
      update sales.order_codes set delivery_verified_at = coalesce(delivery_verified_at, now()) where order_id = p_order;
    end if;
    return 'ok';
  end if;
  if p_kind = 'recogida' then
    update sales.order_codes set pickup_attempts = pickup_attempts + 1 where order_id = p_order;
  else
    update sales.order_codes set delivery_attempts = delivery_attempts + 1 where order_id = p_order;
  end if;
  return 'incorrecto';
end $$;
revoke all on function private.verify_order_code(uuid, text, text) from public, anon, authenticated;

-- Coordinación libera un código bloqueado (con motivo).
create or replace function public.reset_order_code_attempts(p_order uuid, p_kind text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes liberar códigos' using errcode = '42501';
  end if;
  if p_kind not in ('recogida', 'entrega') then
    raise exception 'tipo de código no válido' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'el motivo es obligatorio (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  if p_kind = 'recogida' then
    update sales.order_codes set pickup_attempts = 0 where order_id = p_order;
  else
    update sales.order_codes set delivery_attempts = 0 where order_id = p_order;
  end if;
  if not found then
    raise exception 'el pedido no tiene códigos' using errcode = 'P0002';
  end if;
  perform private.write_audit('order.code_reset', 'order', p_order::text, null, jsonb_build_object('kind', p_kind), btrim(p_reason));
end $$;

-- El comercio ve el código de recogida de sus pedidos listos (sesión de consola).
create or replace function public.order_pickup_code(p_order uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_commerce uuid; v_status text; v_code text;
begin
  select commerce_id, status into v_commerce, v_status from sales.orders where id = p_order;
  if not found or not (private.has_role('comercio', v_commerce) and private.has_strong_session()) then
    raise exception 'no puedes ver el código de este pedido' using errcode = '42501';
  end if;
  if v_status <> 'listo' then
    return null;
  end if;
  select pickup_code into v_code from sales.order_codes where order_id = p_order;
  return v_code;
end $$;

-- El cliente ve el código de entrega de su pedido mientras va en camino.
create or replace function public.my_delivery_code(p_order uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_client uuid; v_status text; v_code text;
begin
  select client_id, status into v_client, v_status from sales.orders where id = p_order;
  if not found or v_client is distinct from auth.uid() or not private.has_valid_session() then
    raise exception 'no puedes ver el código de este pedido' using errcode = '42501';
  end if;
  if v_status <> 'en_camino' then
    return null;
  end if;
  select delivery_code into v_code from sales.order_codes where order_id = p_order;
  return v_code;
end $$;

-- Evidencias --------------------------------------------------------------------------------------------------------------

create table sales.delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sales.orders(id) on delete cascade,
  courier_id uuid not null references identity.couriers(id),
  kind text not null check (kind in ('recogida', 'entrega', 'fallida', 'devolucion_tienda')),
  file_path text not null check (char_length(file_path) between 10 and 300),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  taken_at timestamptz not null default now(),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  distance_m int,
  units_count int check (units_count is null or units_count between 1 and 99),
  note text check (note is null or char_length(note) between 3 and 200),
  flagged boolean not null default false,
  flag_reason text,
  purge_after timestamptz not null,
  purged_at timestamptz,
  constraint evidence_point_pair check ((latitude is null) = (longitude is null))
);
create unique index delivery_evidence_one_per_step on sales.delivery_evidence (order_id, kind) where kind in ('recogida', 'entrega');
create index delivery_evidence_order_idx on sales.delivery_evidence (order_id, taken_at);
create index delivery_evidence_purge_idx on sales.delivery_evidence (purge_after) where purged_at is null;
create unique index delivery_evidence_file_idx on sales.delivery_evidence (file_path);
alter table sales.delivery_evidence enable row level security;

-- De solo adición: nadie la edita ni la borra, salvo el mantenimiento de retención y de anonimización.
create or replace function private.delivery_evidence_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(current_setting('rapitrip.evidence_maint', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'las evidencias no se editan ni se borran' using errcode = '42501';
end $$;
create trigger delivery_evidence_append_only
  before update or delete on sales.delivery_evidence
  for each row execute function private.delivery_evidence_guard();

-- Quién ve cada evidencia.
create or replace function private.can_see_evidence(p_order uuid, p_kind text, p_courier uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_coordination_console()
      or (p_courier is not null and p_courier = private.current_courier_id())
      or exists (
           select 1 from sales.orders o
            where o.id = p_order
              and ((o.client_id = auth.uid() and private.has_valid_session() and p_kind in ('entrega', 'fallida'))
                or (p_kind in ('recogida', 'devolucion_tienda') and private.has_role('comercio', o.commerce_id) and private.has_strong_session())));
$$;
grant execute on function private.can_see_evidence(uuid, text, uuid) to authenticated;

create policy delivery_evidence_select on sales.delivery_evidence
  for select to authenticated using (private.can_see_evidence(order_id, kind, courier_id));
-- Sin latitud ni longitud: la posición del repartidor no sale de la base de datos hacia las pantallas.
grant select (id, order_id, courier_id, kind, file_path, sha256, taken_at, distance_m, units_count, note, flagged, flag_reason, purge_after, purged_at)
  on sales.delivery_evidence to authenticated;

create view public.order_evidence_list with (security_invoker = true) as
  select id, order_id, courier_id, kind, file_path, sha256, taken_at, distance_m, units_count, note, flagged, flag_reason, purged_at
  from sales.delivery_evidence;
revoke all on public.order_evidence_list from public, anon;
grant select on public.order_evidence_list to authenticated;

-- Estado de la cadena por pedido (coordinación y administración): qué falta y qué se marcó.
create view public.order_evidence_status with (security_invoker = true) as
  select o.id as order_id, o.number, o.status, o.courier_id,
         exists (select 1 from sales.delivery_evidence e where e.order_id = o.id and e.kind = 'recogida') as has_pickup,
         exists (select 1 from sales.delivery_evidence e where e.order_id = o.id and e.kind = 'entrega') as has_delivery,
         (select count(*) from sales.delivery_evidence e where e.order_id = o.id and e.flagged)::int as flagged_count,
         (select count(*) from sales.delivery_evidence e where e.order_id = o.id and e.kind = 'fallida')::int as failed_attempts,
         (o.status not in ('en_camino', 'entregado')
            or exists (select 1 from sales.delivery_evidence e where e.order_id = o.id and e.kind = 'recogida')
            or not s.require_pickup_photo)
         and (o.status <> 'entregado'
            or exists (select 1 from sales.delivery_evidence e where e.order_id = o.id and e.kind = 'entrega')
            or not s.require_delivery_photo) as complete
  from sales.orders o
  cross join sales.evidence_settings s
  where o.courier_id is not null and o.status in ('listo', 'en_camino', 'entregado') and private.is_coordination_console();
revoke all on public.order_evidence_status from public, anon;
grant select on public.order_evidence_status to authenticated;

-- Fotos ---------------------------------------------------------------------------------------------------------------------
-- Bucket privado. El repartidor sube solo a <su ficha>/<pedido>/…; las lecturas se firman con la sesión de quien mira.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entregas', 'entregas', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy delivery_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'entregas'
              and (storage.foldername(name))[1] = private.current_courier_id()::text
              and private.is_courier_session());

create or replace function private.can_read_delivery_photo(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_coordination_console()
      or (storage.foldername(p_name))[1] = private.current_courier_id()::text
      or exists (select 1 from sales.delivery_evidence e
                  where e.file_path = p_name and private.can_see_evidence(e.order_id, e.kind, e.courier_id));
$$;
grant execute on function private.can_read_delivery_photo(text) to authenticated;

create policy delivery_photos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'entregas' and private.can_read_delivery_photo(name));

-- Distancia en metros entre dos puntos (haversine).
create or replace function private.distance_m(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric)
returns int language sql immutable set search_path = '' as $$
  select case when p_lat1 is null or p_lng1 is null or p_lat2 is null or p_lng2 is null then null
    else round(12742000 * asin(sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2))))::int end;
$$;

-- Registrar una evidencia (el repartidor) ---------------------------------------------------------------------------------------
-- La foto ya está subida a <su ficha>/<pedido>/<archivo>. Es idempotente por (pedido, tipo, hash): repetirla por mala señal
-- devuelve la misma evidencia.
create or replace function public.courier_add_evidence(
  p_order uuid, p_kind text, p_path text, p_sha256 text,
  p_latitude numeric default null, p_longitude numeric default null, p_units int default null, p_note text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v_order sales.orders;
  v_set sales.evidence_settings;
  v_note text := nullif(btrim(p_note), '');
  v_ref_lat numeric; v_ref_lng numeric;
  v_dist int;
  v_flag text;
  v_id uuid;
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa registra evidencias' using errcode = '42501';
  end if;
  select * into v_order from sales.orders where id = p_order and courier_id = v_courier for update;
  if not found then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  if p_kind is null or p_kind not in ('recogida', 'entrega', 'fallida', 'devolucion_tienda') then
    raise exception 'tipo de evidencia no válido' using errcode = '22023';
  end if;
  if not ((p_kind = 'recogida' and v_order.status = 'listo')
       or (p_kind in ('entrega', 'fallida') and v_order.status = 'en_camino')
       or (p_kind = 'devolucion_tienda' and v_order.status = 'en_camino'
           and exists (select 1 from sales.delivery_evidence e where e.order_id = p_order and e.kind = 'fallida'))) then
    raise exception 'este pedido no admite esa evidencia ahora' using errcode = '22023';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'huella de la foto no válida' using errcode = '22023';
  end if;
  if p_path is null or p_path !~ ('^' || v_courier::text || '/' || p_order::text || '/[A-Za-z0-9._-]{1,100}$') then
    raise exception 'ruta de la foto no válida' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'entregas' and name = p_path) then
    raise exception 'la foto aún no está subida' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) not between 3 and 200 then
    raise exception 'la nota debe tener entre 3 y 200 caracteres' using errcode = '22023';
  end if;
  if p_units is not null and p_units not between 1 and 99 then
    raise exception 'la cantidad de bultos debe estar entre 1 y 99' using errcode = '22023';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'envía la latitud y la longitud juntas' using errcode = '22023';
  end if;
  if p_latitude is not null and not private.valid_ni_point(p_latitude, p_longitude) then
    raise exception 'la ubicación debe estar dentro de Nicaragua' using errcode = '22023';
  end if;

  -- Reintento del mismo envío: devuelve lo ya guardado.
  select id into v_id from sales.delivery_evidence where order_id = p_order and kind = p_kind and sha256 = p_sha256;
  if found then
    return v_id;
  end if;
  if p_kind in ('recogida', 'entrega')
     and exists (select 1 from sales.delivery_evidence where order_id = p_order and kind = p_kind) then
    raise exception 'este pedido ya tiene una evidencia de ese tipo' using errcode = '23505';
  end if;

  select * into v_set from sales.evidence_settings;
  if p_kind in ('entrega', 'fallida') then
    select d.latitude, d.longitude into v_ref_lat, v_ref_lng from sales.order_delivery d where d.order_id = p_order;
  else
    select s.latitude, s.longitude into v_ref_lat, v_ref_lng from commerce.stores s where s.id = v_order.store_id;
  end if;
  v_dist := private.distance_m(p_latitude, p_longitude, v_ref_lat, v_ref_lng);
  if p_latitude is null then
    v_flag := 'sin_ubicacion';
  elsif v_dist is not null and v_dist > v_set.alert_distance_m then
    v_flag := 'lejos_del_punto';
  end if;

  insert into sales.delivery_evidence
    (order_id, courier_id, kind, file_path, sha256, latitude, longitude, distance_m, units_count, note, flagged, flag_reason, purge_after)
  values (p_order, v_courier, p_kind, p_path, p_sha256, p_latitude, p_longitude, v_dist, p_units, v_note, v_flag is not null, v_flag,
          now() + make_interval(days => v_set.retention_days))
  returning id into v_id;
  -- Auditoría sin ruta, coordenadas ni códigos.
  perform private.write_audit('order.evidence_added', 'order', p_order::text, null,
    jsonb_build_object('evidence_id', v_id, 'kind', p_kind, 'flag', v_flag));
  return v_id;
end $$;

-- Lo que el repartidor ya subió de un pedido suyo abierto (para retomar si se cayó la señal).
create or replace function public.courier_order_evidence(p_order uuid)
returns table (evidence_id uuid, kind text, taken_at timestamptz, flagged boolean, flag_reason text, units_count int, note text)
language plpgsql stable security definer set search_path = '' as $$
declare v_courier uuid := private.current_courier_id();
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa ve sus evidencias' using errcode = '42501';
  end if;
  if not exists (select 1 from sales.orders where id = p_order and courier_id = v_courier) then
    raise exception 'pedido no encontrado' using errcode = 'P0002';
  end if;
  return query
    select e.id, e.kind, e.taken_at, e.flagged, e.flag_reason, e.units_count, e.note
      from sales.delivery_evidence e where e.order_id = p_order order by e.taken_at;
end $$;

-- Retención y anonimización ---------------------------------------------------------------------------------------------------
-- La función de borde `purge-evidence` pide qué fotos venció, las borra del almacenamiento y las marca como eliminadas.
-- Quedan la huella, la hora y las marcas: lo que prueba que existieron sin conservar la imagen. No se borra mientras haya
-- una devolución abierta sobre el pedido.

create or replace function public.evidence_pending_purge(p_limit int default 200)
returns table (evidence_id uuid, file_path text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.file_path from sales.delivery_evidence e
   where e.purged_at is null and e.purge_after <= now()
     and not exists (select 1 from sales.return_requests r where r.order_id = e.order_id and r.status = 'solicitada')
   order by e.purge_after
   limit least(greatest(coalesce(p_limit, 200), 1), 500);
$$;

create or replace function public.mark_evidence_purged(p_ids uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  perform set_config('rapitrip.evidence_maint', 'on', true);
  update sales.delivery_evidence set purged_at = now() where id = any (p_ids) and purged_at is null;
  get diagnostics v_count = row_count;
  perform set_config('rapitrip.evidence_maint', 'off', true);
  if v_count > 0 then
    perform private.write_audit('order.evidence_purged', 'evidence', 'batch', null, jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;

-- Al anonimizar a un cliente, sus fotos de entrega (que pueden mostrar su casa) se eliminan en la siguiente pasada.
create or replace function private.expire_evidence_on_anonymize()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('rapitrip.evidence_maint', 'on', true);
  update sales.delivery_evidence e set purge_after = now()
    from sales.orders o where o.id = e.order_id and o.client_id = new.id and e.purged_at is null;
  perform set_config('rapitrip.evidence_maint', 'off', true);
  return new;
end $$;
revoke all on function private.expire_evidence_on_anonymize() from public, anon, authenticated;
create trigger expire_evidence_on_anonymize
  after update of status on identity.profiles
  for each row when (new.status = 'anonimizada' and old.status is distinct from new.status)
  execute function private.expire_evidence_on_anonymize();

-- Permisos ---------------------------------------------------------------------------------------------------------------------
revoke all on function
  public.set_evidence_settings(boolean, boolean, boolean, boolean, int, int),
  public.reset_order_code_attempts(uuid, text, text),
  public.order_pickup_code(uuid), public.my_delivery_code(uuid),
  public.courier_add_evidence(uuid, text, text, text, numeric, numeric, int, text),
  public.courier_order_evidence(uuid),
  public.evidence_pending_purge(int), public.mark_evidence_purged(uuid[])
from public, anon, authenticated;
grant execute on function
  public.set_evidence_settings(boolean, boolean, boolean, boolean, int, int),
  public.reset_order_code_attempts(uuid, text, text),
  public.order_pickup_code(uuid), public.my_delivery_code(uuid),
  public.courier_add_evidence(uuid, text, text, text, numeric, numeric, int, text),
  public.courier_order_evidence(uuid)
to authenticated;
grant execute on function public.evidence_pending_purge(int), public.mark_evidence_purged(uuid[]) to service_role;
