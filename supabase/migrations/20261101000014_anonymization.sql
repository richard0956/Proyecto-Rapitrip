create or replace function private.mark_inactive_candidates()
returns int language plpgsql security definer set search_path = '' as $$
declare v_count int;
begin
  with c as (
    update identity.profiles p
       set anonymization_candidate_since = now()
     where p.status = 'activa'
       and p.anonymization_candidate_since is null
       and coalesce(p.last_sign_in_at, p.created_at) < now() - interval '12 months'
       and not exists (select 1 from identity.user_roles ur
                       where ur.user_id = p.id and ur.role <> 'cliente' and ur.status <> 'revocado')
    returning p.id)
  select count(*) into v_count from c;

  if v_count > 0 then
    perform private.write_audit('account.anonymization_candidates_marked', null, null, null,
      jsonb_build_object('count', v_count));
  end if;
  return v_count;
end $$;

create or replace function public.list_anonymization_candidates()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', p.id,
             'candidate_since', p.anonymization_candidate_since,
             'last_sign_in_at', p.last_sign_in_at)
           order by p.anonymization_candidate_since)
    from identity.profiles p
    where p.status = 'activa' and p.anonymization_candidate_since is not null), '[]'::jsonb);
end $$;

create or replace function public.confirm_anonymization(
  p_user uuid, p_reason text, p_holder_request boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare v identity.profiles;
begin
  perform private.require_admin_console();
  if not private.can_manage('cliente') then
    raise exception 'no tienes permiso para anonimizar cuentas' using errcode = '42501';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 then
    raise exception 'el motivo es obligatorio (mínimo 5 caracteres)' using errcode = '22023';
  end if;

  select * into v from identity.profiles where id = p_user for update;
  if not found then
    raise exception 'cuenta inexistente' using errcode = 'P0002';
  end if;
  if v.status = 'anonimizada' then
    raise exception 'la cuenta ya está anonimizada' using errcode = '22023';
  end if;
  if exists (select 1 from identity.user_roles
             where user_id = p_user and role <> 'cliente' and status <> 'revocado') then
    raise exception 'la cuenta tiene un rol operativo: revócalo antes de anonimizar' using errcode = '22023';
  end if;
  if not p_holder_request and v.anonymization_candidate_since is null then
    raise exception 'la cuenta no es candidata a anonimización' using errcode = '22023';
  end if;

  delete from identity.profile_pii where user_id = p_user;
  update identity.user_roles
     set status = 'revocado', status_reason = 'anonimización',
         status_changed_at = now(), status_changed_by = auth.uid()
   where user_id = p_user and status <> 'revocado';
  update identity.profiles
     set status = 'anonimizada', anonymized_at = now(), anonymized_by = auth.uid(),
         anonymization_candidate_since = null
   where id = p_user;
  delete from private.session_activity where user_id = p_user;
  delete from auth.users where id = p_user;

  perform private.write_audit('account.anonymized', 'profile', p_user::text, null, null, btrim(p_reason),
    jsonb_build_object('holder_request', p_holder_request));
end $$;

revoke all on function public.list_anonymization_candidates() from public, anon;
revoke all on function public.confirm_anonymization(uuid, text, boolean) from public, anon;
grant execute on function public.list_anonymization_candidates() to authenticated;
grant execute on function public.confirm_anonymization(uuid, text, boolean) to authenticated;

select cron.schedule('mark-inactive-candidates', '0 3 * * *', $$select private.mark_inactive_candidates()$$);