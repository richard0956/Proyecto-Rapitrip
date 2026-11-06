-- Controles del catálogo del Manual de Políticas de TI (Política 8).
--   Control 8.1.1  cada semana se revisan los comercios sin actualizar su catálogo o inventario en más de 2 días y se les avisa.
--   Norma 8.2      una inconsistencia reportada se revisa en 24 horas; si se confirma, el comercio la corrige en 24 horas más.
--   Control 8.2.1  la reincidencia la evalúa la administración y decide una medida en 5 días hábiles; queda registrada.

-- Avisos de Rapitrip al comercio (los ve en su consola) ----------------------------------------------------------------
create table commerce.catalog_notices (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references identity.commerces(id),
  kind text not null check (kind in ('sin_actualizar', 'inconsistencia', 'medida')),
  report_id uuid,
  message text not null check (char_length(message) between 5 and 600),
  created_by uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index catalog_notices_commerce_idx on commerce.catalog_notices (commerce_id, created_at desc);

-- Reportes de inconsistencias -------------------------------------------------------------------------------------------
create table commerce.catalog_reports (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references identity.commerces(id),
  store_id uuid not null references commerce.stores(id),
  product_id uuid not null references commerce.products(id),
  reporter_id uuid not null,
  source text not null check (source in ('cliente', 'equipo')),
  kind text not null check (kind in ('precio', 'disponibilidad', 'descripcion', 'imagen', 'otro')),
  description text not null check (char_length(description) between 10 and 500),
  status text not null default 'recibido' check (status in ('recibido', 'descartado', 'confirmado', 'corregido')),
  created_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  fix_due_at timestamptz,
  corrected_at timestamptz,
  correction_note text
);
create index catalog_reports_status_idx on commerce.catalog_reports (status, created_at);
create index catalog_reports_commerce_idx on commerce.catalog_reports (commerce_id, reviewed_at);
alter table commerce.catalog_notices add constraint catalog_notices_report_fk foreign key (report_id) references commerce.catalog_reports(id);

-- Revisiones semanales y medidas: evidencia de los controles, solo de inserción ---------------------------------------
create table commerce.catalog_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now(),
  stale jsonb not null,
  notes text check (notes is null or char_length(notes) <= 1000)
);

create table commerce.catalog_measures (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references identity.commerces(id),
  decided_by uuid not null,
  decided_at timestamptz not null default now(),
  flagged_at timestamptz not null,
  history jsonb not null,
  measure text not null check (char_length(measure) between 5 and 300),
  note text check (note is null or char_length(note) <= 1000)
);

create or replace function private.block_evidence_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'la evidencia de un control no se modifica ni se borra' using errcode = '42501';
end $$;
create trigger catalog_reviews_append_only before update or delete on commerce.catalog_reviews
  for each row execute function private.block_evidence_changes();
create trigger catalog_measures_append_only before update or delete on commerce.catalog_measures
  for each row execute function private.block_evidence_changes();

alter table commerce.catalog_notices enable row level security;
alter table commerce.catalog_reports enable row level security;
alter table commerce.catalog_reviews enable row level security;
alter table commerce.catalog_measures enable row level security;
revoke all on commerce.catalog_notices, commerce.catalog_reports, commerce.catalog_reviews, commerce.catalog_measures from public, anon, authenticated;

-- Plazos ---------------------------------------------------------------------------------------------------------------
create or replace function private.catalog_stale_after() returns interval language sql immutable set search_path = '' as $$ select interval '2 days' $$;
create or replace function private.catalog_review_every() returns interval language sql immutable set search_path = '' as $$ select interval '7 days' $$;
create or replace function private.catalog_fix_window() returns interval language sql immutable set search_path = '' as $$ select interval '24 hours' $$;
create or replace function private.catalog_recurrence_window() returns interval language sql immutable set search_path = '' as $$ select interval '90 days' $$;

-- El comercio de la sesión (rol comercio activo).
create or replace function private.session_commerce()
returns uuid language sql stable security definer set search_path = '' as $$
  select ur.commerce_id from identity.user_roles ur
   where ur.user_id = auth.uid() and ur.role = 'comercio' and ur.status = 'activo' limit 1;
$$;

-- 1. Catálogos sin actualizar (Control 8.1.1) ---------------------------------------------------------------------------
-- Última actividad de cada comercio activo: productos, variantes, inventario o movimientos de stock.
create or replace function private.catalog_activity()
returns table (commerce_id uuid, name text, last_update timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id, c.name,
         greatest(
           (select max(p.updated_at) from commerce.products p join commerce.stores s on s.id = p.store_id where s.commerce_id = c.id),
           (select max(v.updated_at) from commerce.product_variants v join commerce.stores s on s.id = v.store_id where s.commerce_id = c.id),
           (select max(i.updated_at) from commerce.inventory i join commerce.stores s on s.id = i.store_id where s.commerce_id = c.id),
           (select max(m.created_at) from commerce.stock_movements m join commerce.stores s on s.id = m.store_id where s.commerce_id = c.id))
    from identity.commerces c
   where c.status = 'activo';
$$;

create or replace function public.stale_catalogs()
returns table (commerce_id uuid, name text, last_update timestamptz, days int)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_coordination_console() then
    raise exception 'solo coordinación y la administración revisan los catálogos' using errcode = '42501';
  end if;
  return query
    select a.commerce_id, a.name, a.last_update,
           case when a.last_update is null then null else floor(extract(epoch from now() - a.last_update) / 86400)::int end
      from private.catalog_activity() a
     where a.last_update is null or a.last_update < now() - private.catalog_stale_after()
     order by a.last_update nulls first;
end $$;

-- Registra la revisión semanal: guarda la lista encontrada y avisa a cada comercio.
create or replace function public.record_catalog_review(p_notes text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_stale jsonb;
  v_id uuid;
  r record;
begin
  if not private.is_coordination_console() then
    raise exception 'solo coordinación y la administración revisan los catálogos' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('commerce_id', s.commerce_id, 'name', s.name, 'last_update', s.last_update, 'days', s.days)), '[]'::jsonb)
    into v_stale from public.stale_catalogs() s;
  insert into commerce.catalog_reviews (reviewed_by, stale, notes)
  values (auth.uid(), v_stale, nullif(left(btrim(coalesce(p_notes, '')), 1000), ''))
  returning id into v_id;
  for r in select (e ->> 'commerce_id')::uuid as commerce_id, e ->> 'days' as days from jsonb_array_elements(v_stale) e loop
    insert into commerce.catalog_notices (commerce_id, kind, message, created_by)
    values (r.commerce_id, 'sin_actualizar',
            case when r.days is null then 'Tu catálogo todavía no tiene productos ni inventario cargados. Actualízalo para que los clientes vean información correcta.'
                 else format('Tu catálogo o inventario no se actualiza desde hace %s días. Revisa precios y disponibilidad: el manual pide actualizarlos por lo menos una vez al día.', r.days) end,
            auth.uid());
  end loop;
  perform private.write_audit('catalog_review.recorded', 'catalog_review', v_id::text, null,
    jsonb_build_object('stale', jsonb_array_length(v_stale)));
  return jsonb_build_object('id', v_id, 'notified', jsonb_array_length(v_stale));
end $$;

create or replace function public.catalog_review_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_last timestamptz;
begin
  if not private.is_coordination_console() then
    raise exception 'solo coordinación y la administración revisan los catálogos' using errcode = '42501';
  end if;
  select max(reviewed_at) into v_last from commerce.catalog_reviews;
  return jsonb_build_object('last_at', v_last, 'due_at', coalesce(v_last + private.catalog_review_every(), now()),
                            'overdue', v_last is null or v_last + private.catalog_review_every() <= now());
end $$;

create or replace function public.catalog_reviews()
returns table (id uuid, reviewed_at timestamptz, reviewer_name text, stale jsonb, notes text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_coordination_console() then
    raise exception 'solo coordinación y la administración revisan los catálogos' using errcode = '42501';
  end if;
  return query
    select r.id, r.reviewed_at, pii.full_name, r.stale, r.notes
      from commerce.catalog_reviews r left join identity.profile_pii pii on pii.user_id = r.reviewed_by
     order by r.reviewed_at desc limit 12;
end $$;

-- 2. Reportes de inconsistencias (Norma 8.2) ----------------------------------------------------------------------------
-- Lo reporta un cliente desde la tienda o alguien del equipo desde la consola.
create or replace function public.report_catalog_issue(p_product uuid, p_kind text, p_description text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_product commerce.products;
  v_commerce uuid;
  v_source text;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'ingresa para reportar' using errcode = '28000';
  end if;
  if private.is_coordination_console() then
    v_source := 'equipo';
  elsif private.has_role('cliente') then
    perform private.require_valid_session();
    v_source := 'cliente';
  else
    raise exception 'no puedes reportar productos desde esta cuenta' using errcode = '42501';
  end if;
  if p_kind is null or p_kind not in ('precio', 'disponibilidad', 'descripcion', 'imagen', 'otro') then
    raise exception 'elige qué no coincide' using errcode = '22023';
  end if;
  if p_description is null or char_length(btrim(p_description)) not between 10 and 500 then
    raise exception 'cuéntanos qué no coincide (entre 10 y 500 caracteres)' using errcode = '22023';
  end if;
  select * into v_product from commerce.products where id = p_product and status = 'publicado';
  if not found then
    raise exception 'producto no encontrado' using errcode = 'P0002';
  end if;
  if (select count(*) from commerce.catalog_reports where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'ya enviaste varios reportes hoy; gracias, los revisaremos' using errcode = '22023';
  end if;
  v_commerce := private.store_commerce(v_product.store_id);
  insert into commerce.catalog_reports (commerce_id, store_id, product_id, reporter_id, source, kind, description)
  values (v_commerce, v_product.store_id, p_product, auth.uid(), v_source, p_kind, btrim(p_description))
  returning id into v_id;
  perform private.write_audit('catalog_report.created', 'catalog_report', v_id::text, null,
    jsonb_build_object('source', v_source, 'kind', p_kind, 'commerce_id', v_commerce));
  return v_id;
end $$;

create or replace function public.catalog_reports_for_ops()
returns table (id uuid, commerce_id uuid, commerce_name text, store_name text, product_id uuid, product_name text, source text, kind text,
               description text, status text, created_at timestamptz, reviewed_at timestamptz, review_note text, fix_due_at timestamptz,
               corrected_at timestamptz, correction_note text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_coordination_console() then
    raise exception 'solo coordinación y la administración revisan los reportes' using errcode = '42501';
  end if;
  return query
    select r.id, r.commerce_id, c.name, s.name, r.product_id, p.name, r.source, r.kind, r.description, r.status, r.created_at,
           r.reviewed_at, r.review_note, r.fix_due_at, r.corrected_at, r.correction_note
      from commerce.catalog_reports r
      join identity.commerces c on c.id = r.commerce_id
      join commerce.stores s on s.id = r.store_id
      join commerce.products p on p.id = r.product_id
     order by case r.status when 'recibido' then 0 when 'confirmado' then 1 else 2 end, r.created_at desc
     limit 200;
end $$;

-- Revisar: se descarta o se confirma; si se confirma, el comercio recibe el aviso y tiene 24 horas para corregir.
create or replace function public.review_catalog_report(p_id uuid, p_confirmed boolean, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v commerce.catalog_reports;
begin
  if not private.is_coordination_console() then
    raise exception 'solo coordinación y la administración revisan los reportes' using errcode = '42501';
  end if;
  if p_confirmed is null then
    raise exception 'indica si la inconsistencia se confirma' using errcode = '22023';
  end if;
  if p_note is null or char_length(btrim(p_note)) not between 5 and 500 then
    raise exception 'escribe lo que encontraste (entre 5 y 500 caracteres)' using errcode = '22023';
  end if;
  select * into v from commerce.catalog_reports where id = p_id for update;
  if not found then
    raise exception 'reporte inexistente' using errcode = 'P0002';
  end if;
  if v.status <> 'recibido' then
    raise exception 'ese reporte ya fue revisado' using errcode = '22023';
  end if;
  update commerce.catalog_reports
     set status = case when p_confirmed then 'confirmado' else 'descartado' end,
         reviewed_by = auth.uid(), reviewed_at = now(), review_note = btrim(p_note),
         fix_due_at = case when p_confirmed then now() + private.catalog_fix_window() end
   where id = p_id;
  if p_confirmed then
    insert into commerce.catalog_notices (commerce_id, kind, report_id, message, created_by)
    values (v.commerce_id, 'inconsistencia', p_id,
            format('Confirmamos una inconsistencia en «%s»: %s Corrígela en un máximo de 24 horas y márcala como corregida.',
                   (select name from commerce.products where id = v.product_id), btrim(p_note)),
            auth.uid());
  end if;
  perform private.write_audit('catalog_report.reviewed', 'catalog_report', p_id::text, null,
    jsonb_build_object('confirmed', p_confirmed));
end $$;

-- El comercio deja constancia de la corrección.
create or replace function public.mark_catalog_report_fixed(p_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v commerce.catalog_reports;
begin
  select * into v from commerce.catalog_reports where id = p_id for update;
  if not found then
    raise exception 'reporte inexistente' using errcode = 'P0002';
  end if;
  perform private.require_store_manager(v.commerce_id);
  if v.status <> 'confirmado' then
    raise exception 'solo se corrige un reporte confirmado' using errcode = '22023';
  end if;
  if p_note is null or char_length(btrim(p_note)) not between 5 and 500 then
    raise exception 'cuéntanos qué corregiste (entre 5 y 500 caracteres)' using errcode = '22023';
  end if;
  update commerce.catalog_reports set status = 'corregido', corrected_at = now(), correction_note = btrim(p_note) where id = p_id;
  perform private.write_audit('catalog_report.fixed', 'catalog_report', p_id::text, null,
    jsonb_build_object('late', now() > v.fix_due_at));
end $$;

-- Lo que Rapitrip le avisó al comercio de la sesión, con el estado de cada reporte.
create or replace function public.my_catalog_notices()
returns table (id uuid, kind text, message text, created_at timestamptz, read_at timestamptz, report_id uuid, report_status text, fix_due_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_commerce uuid := private.session_commerce();
begin
  perform private.require_console_session();
  if v_commerce is null then
    return;
  end if;
  return query
    select n.id, n.kind, n.message, n.created_at, n.read_at, n.report_id, r.status, r.fix_due_at
      from commerce.catalog_notices n left join commerce.catalog_reports r on r.id = n.report_id
     where n.commerce_id = v_commerce and n.created_at > now() - interval '60 days'
     order by n.created_at desc limit 30;
end $$;

create or replace function public.mark_catalog_notice_read(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_console_session();
  update commerce.catalog_notices set read_at = coalesce(read_at, now())
   where id = p_id and commerce_id = private.session_commerce();
end $$;

-- 3. Reincidencia y medida (Control 8.2.1) ------------------------------------------------------------------------------
-- Un comercio reincide con dos o más inconsistencias confirmadas en 90 días. Queda pendiente hasta que la administración
-- registre una medida posterior a la última confirmación; el plazo de 5 días hábiles cuenta desde que reincidió.
create or replace function public.catalog_recurrences()
returns table (commerce_id uuid, commerce_name text, confirmed int, flagged_at timestamptz, last_measure_at timestamptz, last_measure text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  return query
    with confirmed as (
      select r.commerce_id, r.reviewed_at,
             row_number() over (partition by r.commerce_id order by r.reviewed_at) as n
        from commerce.catalog_reports r
       where r.status in ('confirmado', 'corregido') and r.reviewed_at > now() - private.catalog_recurrence_window()
    ), per as (
      select c.commerce_id, count(*)::int as total, max(c.reviewed_at) as last_confirmed,
             (select min(c2.reviewed_at) from confirmed c2 where c2.commerce_id = c.commerce_id and c2.n = 2) as flagged
        from confirmed c group by c.commerce_id having count(*) >= 2
    )
    select p.commerce_id, co.name, p.total, p.flagged, m.decided_at, m.measure
      from per p
      join identity.commerces co on co.id = p.commerce_id
      left join lateral (select decided_at, measure from commerce.catalog_measures where catalog_measures.commerce_id = p.commerce_id
                          order by decided_at desc limit 1) m on true
     where m.decided_at is null or m.decided_at < p.last_confirmed
     order by p.flagged;
end $$;

create or replace function public.record_catalog_measure(p_commerce uuid, p_measure text, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_flagged timestamptz;
  v_history jsonb;
begin
  perform private.require_admin_console();
  if p_measure is null or char_length(btrim(p_measure)) not between 5 and 300 then
    raise exception 'describe la medida (entre 5 y 300 caracteres)' using errcode = '22023';
  end if;
  select flagged_at into v_flagged from public.catalog_recurrences() where commerce_id = p_commerce;
  if v_flagged is null then
    raise exception 'ese comercio no tiene una reincidencia pendiente' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('report_id', r.id, 'kind', r.kind, 'reviewed_at', r.reviewed_at, 'status', r.status) order by r.reviewed_at), '[]'::jsonb)
    into v_history
    from commerce.catalog_reports r
   where r.commerce_id = p_commerce and r.status in ('confirmado', 'corregido') and r.reviewed_at > now() - private.catalog_recurrence_window();
  insert into commerce.catalog_measures (commerce_id, decided_by, flagged_at, history, measure, note)
  values (p_commerce, auth.uid(), v_flagged, v_history, btrim(p_measure), nullif(left(btrim(coalesce(p_note, '')), 1000), ''))
  returning id into v_id;
  insert into commerce.catalog_notices (commerce_id, kind, message, created_by)
  values (p_commerce, 'medida', format('Por inconsistencias repetidas en tu catálogo, la administración decidió: %s', btrim(p_measure)), auth.uid());
  perform private.write_audit('catalog_measure.recorded', 'commerce', p_commerce::text, null,
    jsonb_build_object('measure_id', v_id, 'reports', jsonb_array_length(v_history)));
  return v_id;
end $$;

revoke all on function
  public.stale_catalogs(), public.record_catalog_review(text), public.catalog_review_status(), public.catalog_reviews(),
  public.report_catalog_issue(uuid, text, text), public.catalog_reports_for_ops(), public.review_catalog_report(uuid, boolean, text),
  public.mark_catalog_report_fixed(uuid, text), public.my_catalog_notices(), public.mark_catalog_notice_read(uuid),
  public.catalog_recurrences(), public.record_catalog_measure(uuid, text, text)
from public, anon;
grant execute on function
  public.stale_catalogs(), public.record_catalog_review(text), public.catalog_review_status(), public.catalog_reviews(),
  public.report_catalog_issue(uuid, text, text), public.catalog_reports_for_ops(), public.review_catalog_report(uuid, boolean, text),
  public.mark_catalog_report_fixed(uuid, text), public.my_catalog_notices(), public.mark_catalog_notice_read(uuid),
  public.catalog_recurrences(), public.record_catalog_measure(uuid, text, text)
to authenticated;
