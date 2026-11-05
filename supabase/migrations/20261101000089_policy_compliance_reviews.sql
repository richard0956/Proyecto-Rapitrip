-- Cumplimiento del Manual de Políticas de TI (tercer bloque).
--   Norma 1.1.6   la administración revisa cada 3 meses los accesos de cada rol, y queda constancia.
--   Control 1.1.1 / 3.1.1  toda salida de información dice el motivo, el destinatario verificado y el canal.
--   Norma 3.3.4   un incidente que expone datos personales se notifica a los afectados en 72 horas, y queda constancia.

-- 1. Revisión trimestral de accesos ----------------------------------------------------------------------------------------
-- Es evidencia del control: vive fuera de la auditoría (que se borra a los 30 días) y no se edita ni se borra.
create table identity.access_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewed_by uuid not null references identity.profiles(id),
  reviewed_at timestamptz not null default now(),
  -- Foto de lo revisado: cuántas cuentas hay por rol y estado en ese momento.
  snapshot jsonb not null,
  findings text not null check (char_length(findings) between 10 and 2000),
  changes text check (changes is null or char_length(changes) <= 2000)
);
alter table identity.access_reviews enable row level security;
revoke all on identity.access_reviews from public, anon, authenticated;

create or replace function private.block_access_review_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'una revisión de accesos registrada no se modifica ni se borra' using errcode = '42501';
end $$;
create trigger access_reviews_append_only
  before update or delete on identity.access_reviews
  for each row execute function private.block_access_review_changes();

create or replace function private.access_review_every()
returns interval language sql immutable set search_path = '' as $$ select interval '3 months' $$;

create or replace function public.record_access_review(p_findings text, p_changes text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_snapshot jsonb;
begin
  perform private.require_admin_console();
  if p_findings is null or char_length(btrim(p_findings)) not between 10 and 2000 then
    raise exception 'describe lo que revisaste (entre 10 y 2000 caracteres)' using errcode = '22023';
  end if;
  select coalesce(jsonb_object_agg(role, counts), '{}'::jsonb) into v_snapshot from (
    select ur.role::text as role, jsonb_object_agg(ur.status::text, n) as counts
      from (select role, status, count(*) as n from identity.user_roles where role <> 'cliente' group by role, status) ur
     group by ur.role
  ) s;
  insert into identity.access_reviews (reviewed_by, snapshot, findings, changes)
  values (auth.uid(), v_snapshot, btrim(p_findings), nullif(btrim(coalesce(p_changes, '')), ''))
  returning id into v_id;
  perform private.write_audit('access_review.recorded', 'access_review', v_id::text, null, v_snapshot);
  return v_id;
end $$;

create or replace function public.access_reviews()
returns table (id uuid, reviewed_at timestamptz, reviewer_name text, snapshot jsonb, findings text, changes text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  return query
    select r.id, r.reviewed_at, pii.full_name, r.snapshot, r.findings, r.changes
      from identity.access_reviews r
      left join identity.profile_pii pii on pii.user_id = r.reviewed_by
     order by r.reviewed_at desc
     limit 20;
end $$;

-- Cuándo toca la próxima: tres meses después de la última; si nunca se hizo, ya toca.
create or replace function public.access_review_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_last timestamptz;
begin
  perform private.require_admin_console();
  select max(reviewed_at) into v_last from identity.access_reviews;
  return jsonb_build_object(
    'last_at', v_last,
    'due_at', coalesce(v_last + private.access_review_every(), now()),
    'overdue', v_last is null or v_last + private.access_review_every() <= now());
end $$;

revoke all on function public.record_access_review(text, text), public.access_reviews(), public.access_review_status() from public, anon;
grant execute on function public.record_access_review(text, text), public.access_reviews(), public.access_review_status() to authenticated;

-- 2. Exportación con destinatario y canal ---------------------------------------------------------------------------------
drop function public.export_dataset(text, text, timestamptz, timestamptz);
create or replace function public.export_dataset(
  p_dataset text, p_reason text, p_from timestamptz default null, p_to timestamptz default null,
  p_recipient text default null, p_channel text default null, p_identity_verified boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_rows jsonb;
  v_count int;
  v_recipient text := nullif(left(btrim(coalesce(p_recipient, '')), 200), '');
  v_channel text := nullif(left(btrim(coalesce(p_channel, '')), 120), '');
begin
  perform private.require_admin_console();
  if not private.has_recent_mfa(5) then
    raise exception 'confirma tu segundo factor de nuevo (últimos 5 minutos)' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'el motivo es obligatorio (mínimo 10 caracteres)' using errcode = '22023';
  end if;
  -- Control 1.1.1: quién recibe la información, por qué canal y con su identidad verificada.
  if v_recipient is null or char_length(v_recipient) < 3 then
    raise exception 'indica el destinatario de la información' using errcode = '22023';
  end if;
  if v_channel is null then
    raise exception 'indica el canal por el que la enviarás' using errcode = '22023';
  end if;
  if p_identity_verified is not true then
    raise exception 'verifica la identidad del destinatario antes de exportar' using errcode = '22023';
  end if;

  case p_dataset
    when 'audit' then
      select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]'::jsonb) into v_rows
      from audit.events e
      where (p_from is null or e.occurred_at >= p_from) and (p_to is null or e.occurred_at < p_to);
    when 'login_events' then
      select coalesce(jsonb_agg(to_jsonb(l) order by l.id), '[]'::jsonb) into v_rows
      from audit.login_events l
      where (p_from is null or l.occurred_at >= p_from) and (p_to is null or l.occurred_at < p_to);
    when 'accounts' then
      select coalesce(jsonb_agg(jsonb_build_object(
               'user_id', p.id, 'full_name', pii.full_name, 'email', pii.email,
               'account_status', p.status, 'role', ur.role, 'role_status', ur.status,
               'commerce_id', ur.commerce_id) order by p.created_at, ur.role), '[]'::jsonb) into v_rows
      from identity.user_roles ur
      join identity.profiles p on p.id = ur.user_id
      left join identity.profile_pii pii on pii.user_id = p.id
      where ur.role <> 'cliente';
    when 'couriers' then
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', c.id, 'full_name', c.full_name, 'phone', c.phone, 'vehicle_type', c.vehicle_type,
               'status', c.status, 'created_at', c.created_at) order by c.created_at), '[]'::jsonb) into v_rows
      from identity.couriers c;
    else
      raise exception 'conjunto de datos no exportable: %', p_dataset using errcode = '22023';
  end case;

  v_count := jsonb_array_length(v_rows);
  if v_count > 50000 then
    raise exception 'demasiados registros (%): acota el rango de fechas', v_count using errcode = '22023';
  end if;

  -- El destinatario va en la auditoría como texto libre que escribe la administración (nombre o cargo, sin datos sensibles).
  perform private.write_audit('export', 'dataset', p_dataset, null, null, btrim(p_reason),
    jsonb_build_object('count', v_count, 'recipient', v_recipient, 'channel', v_channel, 'identity_verified', true));
  return jsonb_build_object('count', v_count, 'rows', v_rows);
end $$;

revoke all on function public.export_dataset(text, text, timestamptz, timestamptz, text, text, boolean) from public, anon;
grant execute on function public.export_dataset(text, text, timestamptz, timestamptz, text, text, boolean) to authenticated;

-- 3. Aviso a los afectados en 72 horas -------------------------------------------------------------------------------------
create or replace function public.record_incident_notice(p_incident uuid, p_channel text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v audit.it_incidents;
begin
  perform private.require_admin_console();
  if p_channel is null or char_length(btrim(p_channel)) < 3 then
    raise exception 'indica por qué medio avisaste a los afectados' using errcode = '22023';
  end if;
  if p_note is null or char_length(btrim(p_note)) < 10 then
    raise exception 'describe qué les informaste (mínimo 10 caracteres)' using errcode = '22023';
  end if;
  select * into v from audit.it_incidents where id = p_incident for update;
  if not found then
    raise exception 'incidente inexistente' using errcode = 'P0002';
  end if;
  if v.type <> 'seguridad' then
    raise exception 'el aviso a los afectados es para incidentes de seguridad' using errcode = '22023';
  end if;
  if v.metadata ? 'notified_at' then
    raise exception 'el aviso a los afectados ya está registrado' using errcode = '22023';
  end if;
  update audit.it_incidents
     set metadata = metadata || jsonb_build_object('notified_at', now(), 'notice_channel', left(btrim(p_channel), 120),
                                                   'notice_note', left(btrim(p_note), 500), 'notified_by', auth.uid())
   where id = p_incident;
  perform private.write_audit('incident.notice_recorded', 'it_incident', p_incident::text, null,
    jsonb_build_object('channel', left(btrim(p_channel), 120)));
end $$;

revoke all on function public.record_incident_notice(uuid, text, text) from public, anon;
grant execute on function public.record_incident_notice(uuid, text, text) to authenticated;

create or replace view public.it_incidents_list with (security_invoker = true) as
  select id, type, origin, severity, description, status, resolution, created_at, resolved_at,
         metadata ->> 'source' as source,
         metadata ->> 'where' as reported_from,
         metadata ->> 'reporter' as reporter_name,
         (metadata ->> 'occurred_at')::timestamptz as occurred_at,
         metadata ->> 'data_involved' as data_involved,
         metadata ->> 'affected' as affected,
         (metadata ->> 'notified_at')::timestamptz as notified_at,
         metadata ->> 'notice_channel' as notice_channel
  from audit.it_incidents;
