-- Lecturas de administración que el frontend necesita y que no tenían ruta:
-- auditoría, inicios de sesión y comercios. Las dos primeras son lecturas sensibles:
-- pasan por una función que valida la sesión de consola y registra la propia consulta.

create or replace function public.audit_events_page(
  p_action text default null,
  p_actor uuid default null,
  p_target_type text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 50,
  p_before bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb;
  v_more boolean;
begin
  perform private.require_admin_console();

  with page as (
    select e.id, e.occurred_at, e.actor_id, e.actor_role, e.action, e.target_type, e.target_id, e.reason, e.metadata
    from audit.events e
    where (p_before is null or e.id < p_before)
      and (p_action is null or e.action = p_action)
      and (p_actor is null or e.actor_id = p_actor)
      and (p_target_type is null or e.target_type = p_target_type)
      and (p_from is null or e.occurred_at >= p_from)
      and (p_to is null or e.occurred_at < p_to)
    order by e.id desc
    limit v_limit + 1
  ), ranked as (
    select page.*, row_number() over (order by page.id desc) as rn from page
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'occurred_at', r.occurred_at, 'actor_id', r.actor_id, 'actor_role', r.actor_role,
           'action', r.action, 'target_type', r.target_type, 'target_id', r.target_id,
           'reason', r.reason, 'metadata', r.metadata) order by r.id desc) filter (where r.rn <= v_limit), '[]'::jsonb),
         coalesce(bool_or(r.rn > v_limit), false)
    into v_rows, v_more
  from ranked r;

  perform private.write_audit('read_sensitive', 'audit_log', null, null, null, null,
    jsonb_build_object('resource', 'audit_events', 'paged', p_before is not null,
                       'rows', jsonb_array_length(v_rows)));
  return jsonb_build_object('rows', v_rows, 'has_more', v_more);
end $$;

create or replace function public.login_events_page(
  p_user uuid default null,
  p_result text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_limit int default 50,
  p_before bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_rows jsonb;
  v_more boolean;
begin
  perform private.require_admin_console();
  if p_result is not null and p_result not in ('exitoso', 'fallido') then
    raise exception 'resultado inválido' using errcode = '22023';
  end if;

  with page as (
    select l.id, l.user_id, l.occurred_at, l.result, l.provider, l.ip_address, l.user_agent
    from audit.login_events l
    where (p_before is null or l.id < p_before)
      and (p_user is null or l.user_id = p_user)
      and (p_result is null or l.result = p_result)
      and (p_from is null or l.occurred_at >= p_from)
      and (p_to is null or l.occurred_at < p_to)
    order by l.id desc
    limit v_limit + 1
  ), ranked as (
    select page.*, row_number() over (order by page.id desc) as rn from page
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'user_id', r.user_id, 'occurred_at', r.occurred_at, 'result', r.result,
           'provider', r.provider, 'ip_address', r.ip_address, 'user_agent', r.user_agent)
           order by r.id desc) filter (where r.rn <= v_limit), '[]'::jsonb),
         coalesce(bool_or(r.rn > v_limit), false)
    into v_rows, v_more
  from ranked r;

  perform private.write_audit('read_sensitive', 'login_events', null, null, null, null,
    jsonb_build_object('resource', 'login_events', 'paged', p_before is not null,
                       'rows', jsonb_array_length(v_rows)));
  return jsonb_build_object('rows', v_rows, 'has_more', v_more);
end $$;

-- Comercios: las políticas de identity.commerces ya limitan quién ve qué.
create view public.commerces_list with (security_invoker = true) as
  select id, name, status, created_at from identity.commerces;

revoke all on function public.audit_events_page(text, uuid, text, timestamptz, timestamptz, int, bigint) from public, anon;
revoke all on function public.login_events_page(uuid, text, timestamptz, timestamptz, int, bigint) from public, anon;
grant execute on function public.audit_events_page(text, uuid, text, timestamptz, timestamptz, int, bigint) to authenticated;
grant execute on function public.login_events_page(uuid, text, timestamptz, timestamptz, int, bigint) to authenticated;

revoke all on public.commerces_list from public, anon;
grant select on public.commerces_list to authenticated;
