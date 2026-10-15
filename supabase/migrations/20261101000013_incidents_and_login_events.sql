create extension if not exists pg_cron;

-- Copia los inicios de sesión del registro de Auth. Idempotente por source_audit_id.
create or replace function private.sync_login_events()
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  insert into audit.login_events (source_audit_id, user_id, occurred_at, result, provider, ip_address, user_agent)
  select a.id,
         nullif(a.payload ->> 'actor_id', '')::uuid,
         a.created_at,
         'exitoso',
         a.payload -> 'traits' ->> 'provider',
         a.ip_address::text,
         a.payload ->> 'user_agent'
  from auth.audit_log_entries a
  where a.payload ->> 'action' = 'login'
    and a.created_at >= coalesce((select max(occurred_at) from audit.login_events where source_audit_id is not null),
                                 '-infinity'::timestamptz)
  on conflict (source_audit_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function private.notify_incident(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v audit.it_incidents;
  r record;
begin
  select * into v from audit.it_incidents where id = p_id;
  if not found or v.severity <> 'alta' then return; end if;
  for r in
    select distinct pii.email
    from identity.user_roles ur
    join identity.profile_pii pii on pii.user_id = ur.user_id
    where ur.role in ('admin', 'superadmin') and ur.status = 'activo' and pii.email is not null
  loop
    perform private.enqueue_email(r.email, 'incident_alert',
      jsonb_build_object('severity', v.severity, 'description', v.description));
  end loop;
end $$;

-- 10 fallos en una hora en una cuenta con acceso a la consola abren un incidente de gravedad alta.
create or replace function private.evaluate_failed_logins()
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_count int := 0;
  v_id uuid;
  r record;
begin
  for r in
    select le.user_id, count(*) as fails
    from audit.login_events le
    where le.result = 'fallido'
      and le.user_id is not null
      and le.occurred_at > now() - interval '1 hour'
      and exists (select 1 from identity.user_roles ur
                  where ur.user_id = le.user_id and ur.role <> 'cliente' and ur.status = 'activo')
    group by le.user_id
    having count(*) >= 10
  loop
    if not exists (
      select 1 from audit.it_incidents i
      where i.origin = 'automatico' and i.type = 'seguridad'
        and (i.metadata ->> 'user_id')::uuid = r.user_id
        and i.created_at > now() - interval '1 hour'
    ) then
      insert into audit.it_incidents (type, origin, severity, description, metadata)
      values ('seguridad', 'automatico', 'alta',
              'Intentos fallidos de inicio de sesión repetidos en una cuenta con acceso a la consola',
              jsonb_build_object('user_id', r.user_id, 'failed_attempts', r.fails))
      returning id into v_id;
      perform private.write_audit('incident.created', 'it_incident', v_id::text, null,
        jsonb_build_object('origin', 'automatico', 'user_id', r.user_id));
      perform private.notify_incident(v_id);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end $$;

create or replace function public.report_incident(
  p_type audit.incident_type, p_severity audit.incident_severity, p_description text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_console_session();
  if not private.is_ops_console() then
    raise exception 'no tienes permiso para reportar incidentes' using errcode = '42501';
  end if;
  if p_description is null or char_length(btrim(p_description)) not between 5 and 2000 then
    raise exception 'la descripción debe tener entre 5 y 2000 caracteres' using errcode = '22023';
  end if;
  insert into audit.it_incidents (type, origin, severity, description, reported_by)
  values (p_type, 'manual', p_severity, btrim(p_description), auth.uid())
  returning id into v_id;
  perform private.write_audit('incident.created', 'it_incident', v_id::text, null,
    jsonb_build_object('origin', 'manual', 'severity', p_severity));
  perform private.notify_incident(v_id);
  return v_id;
end $$;

create or replace function public.set_incident_status(
  p_id uuid, p_status audit.incident_status, p_resolution text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare v audit.it_incidents;
begin
  perform private.require_admin_console();
  select * into v from audit.it_incidents where id = p_id for update;
  if not found then
    raise exception 'incidente inexistente' using errcode = 'P0002';
  end if;
  if not ((v.status = 'abierto' and p_status in ('en_atencion', 'resuelto'))
       or (v.status = 'en_atencion' and p_status = 'resuelto')) then
    raise exception 'transición no permitida: % a %', v.status, p_status using errcode = '22023';
  end if;
  if p_status = 'resuelto' and (p_resolution is null or char_length(btrim(p_resolution)) < 5) then
    raise exception 'cerrar un incidente exige una resolución (mínimo 5 caracteres)' using errcode = '22023';
  end if;

  update audit.it_incidents
     set status = p_status,
         resolution = case when p_status = 'resuelto' then btrim(p_resolution) else resolution end,
         handled_by = auth.uid(),
         updated_at = now(),
         resolved_at = case when p_status = 'resuelto' then now() else resolved_at end
   where id = p_id;
  perform private.write_audit('incident.status_changed', 'it_incident', p_id::text,
    jsonb_build_object('status', v.status), jsonb_build_object('status', p_status));
end $$;

revoke all on function public.report_incident(audit.incident_type, audit.incident_severity, text) from public, anon;
revoke all on function public.set_incident_status(uuid, audit.incident_status, text) from public, anon;
grant execute on function public.report_incident(audit.incident_type, audit.incident_severity, text) to authenticated;
grant execute on function public.set_incident_status(uuid, audit.incident_status, text) to authenticated;

select cron.schedule('sync-login-events', '* * * * *', $$select private.sync_login_events()$$);
select cron.schedule('evaluate-failed-logins', '*/5 * * * *', $$select private.evaluate_failed_logins()$$);
select cron.schedule('purge-session-activity', '30 3 * * *',
  $$delete from private.session_activity where last_activity_at < now() - interval '2 days'$$);