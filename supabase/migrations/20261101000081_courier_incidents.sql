-- Incidentes de TI reportados por el repartidor desde la app (Perfil → Ayuda). Van a la misma tabla que los de la consola
-- (`audit.it_incidents`), así la administración los ve en «Incidentes de TI» y los de gravedad alta avisan por correo igual.
-- `report_incident` sigue siendo solo de la consola; el repartidor tiene su propia puerta, con tope diario y el contexto del teléfono.

create or replace function public.courier_report_incident(
  p_type audit.incident_type,
  p_severity audit.incident_severity,
  p_description text,
  p_where text default null,
  p_device text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_courier uuid;
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
  -- Un tope sencillo contra el envío repetido: 5 reportes por día.
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
            'device', nullif(left(btrim(coalesce(p_device, '')), 300), ''))))
  returning id into v_id;
  perform private.write_audit('incident.created', 'it_incident', v_id::text, null,
    jsonb_build_object('origin', 'manual', 'source', 'repartidor', 'severity', p_severity));
  perform private.notify_incident(v_id);
  return v_id;
end $$;

revoke all on function public.courier_report_incident(audit.incident_type, audit.incident_severity, text, text, text) from public, anon;
grant execute on function public.courier_report_incident(audit.incident_type, audit.incident_severity, text, text, text) to authenticated;

-- La consola muestra de dónde vino el reporte: columnas nuevas al final (la vista conserva las de antes en el mismo orden).
create or replace view public.it_incidents_list with (security_invoker = true) as
  select id, type, origin, severity, description, status, resolution, created_at, resolved_at,
         metadata ->> 'source' as source,
         metadata ->> 'where' as reported_from
  from audit.it_incidents;
