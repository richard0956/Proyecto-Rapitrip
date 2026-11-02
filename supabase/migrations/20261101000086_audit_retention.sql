-- Retención de «Auditoría y accesos»: los registros de auditoría (`audit.events`) y de inicios de sesión (`audit.login_events`)
-- se conservan 30 días y luego se borran solos cada madrugada.
--
-- Las dos tablas siguen siendo de solo inserción: el trigger rechaza todo UPDATE, TRUNCATE y DELETE, salvo el borrado que hace
-- esta tarea de mantenimiento (marca local de la transacción) y únicamente de filas con más de 30 días. Nadie puede usarla
-- para borrar algo reciente, y `authenticated` ni siquiera tiene permiso de DELETE sobre estas tablas.

create or replace function private.audit_retention_days() returns int language sql immutable as $$ select 30 $$;

-- El mismo trigger protege `audit.it_incidents`, que no tiene retención: solo las dos tablas de registros admiten la excepción.
-- Los IF van anidados para no leer `occurred_at` de una tabla que no la tiene.
create or replace function audit.block_mutation()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and tg_table_name in ('events', 'login_events') and current_setting('audit.retention_purge', true) = 'on' then
    if old.occurred_at < now() - make_interval(days => private.audit_retention_days()) then
      return old;
    end if;
  end if;
  raise exception 'la tabla audit.% es de solo inserción (%)', tg_table_name, tg_op
    using errcode = '42501';
end $$;

-- Borra lo vencido de las dos tablas y deja constancia de cuánto se borró (esa constancia también vence a los 30 días).
create or replace function private.purge_audit_logs()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_limit timestamptz := now() - make_interval(days => private.audit_retention_days());
  v_events int;
  v_logins int;
begin
  perform set_config('audit.retention_purge', 'on', true);
  delete from audit.events where occurred_at < v_limit;
  get diagnostics v_events = row_count;
  delete from audit.login_events where occurred_at < v_limit;
  get diagnostics v_logins = row_count;
  perform set_config('audit.retention_purge', 'off', true);
  if v_events + v_logins > 0 then
    perform private.write_audit('audit.retention_purged', 'audit', null, null,
      jsonb_build_object('events', v_events, 'login_events', v_logins, 'retention_days', private.audit_retention_days()));
  end if;
  return jsonb_build_object('events', v_events, 'login_events', v_logins);
end $$;

revoke all on function private.purge_audit_logs() from public, anon, authenticated;

-- Copia los inicios de sesión del registro de Auth, sin volver a traer los que ya vencieron (si no, al borrarlos todos la
-- copia volvería a empezar desde el principio del registro de Auth).
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
    and a.created_at >= greatest(
          coalesce((select max(occurred_at) from audit.login_events where source_audit_id is not null), '-infinity'::timestamptz),
          now() - make_interval(days => private.audit_retention_days()))
  on conflict (source_audit_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

select cron.schedule('purge-audit-logs', '15 4 * * *', $$select private.purge_audit_logs()$$);
