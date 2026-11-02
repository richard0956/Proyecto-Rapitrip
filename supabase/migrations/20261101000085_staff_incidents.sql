-- Incidentes de TI reportados por caja, coordinación y comercio desde su consola (menú «Reportar incidente»). Van a la misma
-- tabla (`audit.it_incidents`), así la administración los ve en «Incidentes de TI» y los de gravedad alta avisan por correo
-- igual. `report_incident` sigue siendo la puerta de la administración; esta guarda además quién reportó, desde qué rol y
-- en qué pantalla pasó, con un tope diario contra el envío repetido.

create or replace function public.staff_report_incident(
  p_type audit.incident_type,
  p_severity audit.incident_severity,
  p_description text,
  p_where text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_source text;
  v_name text;
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
  -- Un tope sencillo contra el envío repetido: 10 reportes por día y persona.
  if (select count(*) from audit.it_incidents
       where reported_by = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'ya enviaste varios reportes hoy; si es urgente, llama a la administración' using errcode = '22023';
  end if;

  -- El nombre se copia al reportar: la lista de la administración lo muestra sin leer datos personales.
  select nullif(btrim(full_name), '') into v_name from identity.profile_pii where user_id = auth.uid();

  insert into audit.it_incidents (type, origin, severity, description, reported_by, metadata)
  values (p_type, 'manual', p_severity, btrim(p_description), auth.uid(),
          jsonb_strip_nulls(jsonb_build_object(
            'source', v_source,
            'reporter', v_name,
            'where', nullif(left(btrim(coalesce(p_where, '')), 80), ''))))
  returning id into v_id;
  perform private.write_audit('incident.created', 'it_incident', v_id::text, null,
    jsonb_build_object('origin', 'manual', 'source', v_source, 'severity', p_severity));
  perform private.notify_incident(v_id);
  return v_id;
end $$;

-- Lo que reportó la persona en sesión, con su estado y la resolución, para que sepa si ya se atendió.
create or replace function public.my_incidents()
returns table (id uuid, type audit.incident_type, severity audit.incident_severity, description text, status audit.incident_status,
               resolution text, reported_from text, created_at timestamptz, resolved_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select i.id, i.type, i.severity, i.description, i.status, i.resolution, i.metadata ->> 'where', i.created_at, i.resolved_at
  from audit.it_incidents i
  where i.reported_by = auth.uid() and private.has_strong_session()
  order by i.created_at desc
  limit 50;
$$;

revoke all on function public.staff_report_incident(audit.incident_type, audit.incident_severity, text, text) from public, anon;
grant execute on function public.staff_report_incident(audit.incident_type, audit.incident_severity, text, text) to authenticated;
revoke all on function public.my_incidents() from public, anon;
grant execute on function public.my_incidents() to authenticated;

-- La administración ve quién reportó: columna nueva al final (la vista conserva las de antes en el mismo orden).
create or replace view public.it_incidents_list with (security_invoker = true) as
  select id, type, origin, severity, description, status, resolution, created_at, resolved_at,
         metadata ->> 'source' as source,
         metadata ->> 'where' as reported_from,
         metadata ->> 'reporter' as reporter_name
  from audit.it_incidents;
