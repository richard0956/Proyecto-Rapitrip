insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;
-- Sin políticas sobre storage.objects: solo la Edge Function (service_role) escribe y firma enlaces.

create or replace function public.reset_mfa(p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  if not private.has_recent_mfa(5) then
    raise exception 'confirma tu segundo factor de nuevo (últimos 5 minutos)' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'el motivo es obligatorio (mínimo 10 caracteres)' using errcode = '22023';
  end if;
  if p_target = auth.uid() then
    raise exception 'no puedes restablecer tu propio segundo factor' using errcode = '42501';
  end if;
  if not exists (
    select 1 from identity.user_roles ur
    where ur.user_id = p_target and ur.role <> 'cliente' and ur.status <> 'revocado'
      and private.can_manage(ur.role)
  ) then
    raise exception 'no puedes restablecer el segundo factor de esa cuenta' using errcode = '42501';
  end if;

  delete from auth.mfa_factors where user_id = p_target;
  delete from auth.sessions where user_id = p_target;
  delete from private.session_activity where user_id = p_target;

  perform private.write_audit('mfa.reset', 'profile', p_target::text, null, null, btrim(p_reason));
end $$;

create or replace function public.export_dataset(
  p_dataset text, p_reason text, p_from timestamptz default null, p_to timestamptz default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_rows jsonb;
  v_count int;
begin
  perform private.require_admin_console();
  if not private.has_recent_mfa(5) then
    raise exception 'confirma tu segundo factor de nuevo (últimos 5 minutos)' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 10 then
    raise exception 'el motivo es obligatorio (mínimo 10 caracteres)' using errcode = '22023';
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

  perform private.write_audit('export', 'dataset', p_dataset, null, null, btrim(p_reason),
    jsonb_build_object('count', v_count));
  return jsonb_build_object('count', v_count, 'rows', v_rows);
end $$;

create or replace function public.audit_script_action(p_action text, p_target uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_action is null or p_action !~ '^script\.[a-z_]+$' then
    raise exception 'acción de script inválida' using errcode = '22023';
  end if;
  perform private.write_audit(p_action, 'profile', p_target::text, null, null, p_reason);
end $$;

revoke all on function public.reset_mfa(uuid, text) from public, anon;
revoke all on function public.export_dataset(text, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.reset_mfa(uuid, text) to authenticated;
grant execute on function public.export_dataset(text, text, timestamptz, timestamptz) to authenticated;
revoke all on function public.audit_script_action(text, uuid, text) from public, anon, authenticated;
grant execute on function public.audit_script_action(text, uuid, text) to service_role;