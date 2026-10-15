create or replace function public.create_invitation(p_email text, p_role identity.app_role, p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(p_email));
  v_id uuid;
  v_prev uuid;
  v_exp timestamptz := now() + interval '4 days';
begin
  perform private.require_console_session();
  if p_role not in ('admin', 'cajero', 'coordinador') then
    raise exception 'ese rol no se asigna por invitación' using errcode = '22023';
  end if;
  if not private.can_manage(p_role) then
    raise exception 'no tienes permiso para invitar al rol %', p_role using errcode = '42501';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'correo inválido' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'hash de token inválido' using errcode = '22023';
  end if;
  if exists (
    select 1 from identity.profile_pii pii
    join identity.user_roles ur on ur.user_id = pii.user_id
    where lower(pii.email) = v_email and ur.role = p_role and ur.status <> 'revocado'
  ) then
    raise exception 'esa persona ya tiene el rol %', p_role using errcode = '23505';
  end if;

  update identity.invitations set status = 'cancelada'
   where lower(email) = v_email and role = p_role and status = 'pendiente'
  returning id into v_prev;

  insert into identity.invitations (email, role, invited_by, token_hash, expires_at)
  values (v_email, p_role, auth.uid(), p_token_hash, v_exp)
  returning id into v_id;

  perform private.write_audit('invitation.created', 'invitation', v_id::text, null,
    jsonb_build_object('role', p_role, 'replaced', v_prev));
  return jsonb_build_object('id', v_id, 'expires_at', v_exp);
end $$;

create or replace function public.cancel_invitation(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v identity.invitations;
begin
  perform private.require_console_session();
  select * into v from identity.invitations where id = p_id for update;
  if not found then
    raise exception 'invitación inexistente' using errcode = 'P0002';
  end if;
  if not private.can_manage(v.role) then
    raise exception 'no tienes permiso sobre esa invitación' using errcode = '42501';
  end if;
  if v.status <> 'pendiente' then
    raise exception 'solo se cancelan invitaciones pendientes' using errcode = '22023';
  end if;
  update identity.invitations set status = 'cancelada' where id = p_id;
  perform private.write_audit('invitation.cancelled', 'invitation', p_id::text);
end $$;

-- Los tres siguientes los usa solo la Edge Function accept-invitation (service_role).
create or replace function public.begin_accept_invitation(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v identity.invitations;
begin
  select * into v from identity.invitations where token_hash = p_token_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalida');
  end if;
  if v.status <> 'pendiente' then
    return jsonb_build_object('ok', false, 'reason', 'no_disponible');
  end if;
  if v.expires_at <= now() then
    update identity.invitations set status = 'vencida' where id = v.id;
    return jsonb_build_object('ok', false, 'reason', 'vencida');
  end if;
  return jsonb_build_object('ok', true, 'invitation_id', v.id, 'email', lower(v.email), 'role', v.role);
end $$;

create or replace function public.finish_accept_invitation(p_token_hash text, p_user uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v identity.invitations;
begin
  select * into v from identity.invitations where token_hash = p_token_hash for update;
  if not found or v.status <> 'pendiente' or v.expires_at <= now() then
    return false;
  end if;
  -- La cuenta debe ser la del correo invitado.
  if not exists (select 1 from identity.profile_pii where user_id = p_user and lower(email) = lower(v.email)) then
    return false;
  end if;
  perform private.grant_role(p_user, v.role, null, v.invited_by);
  update identity.invitations
     set status = 'aceptada', accepted_at = now(), accepted_by = p_user
   where id = v.id;
  perform private.write_audit('invitation.accepted', 'invitation', v.id::text, null,
    jsonb_build_object('role', v.role, 'user_id', p_user));
  return true;
end $$;

create or replace function public.lookup_auth_user(p_email text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object(
        'id', u.id,
        'email_confirmed', u.email_confirmed_at is not null,
        'has_password', exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'))
     from auth.users u
     where lower(u.email) = lower(btrim(p_email))
     limit 1),
    'null'::jsonb);
$$;

revoke all on function public.create_invitation(text, identity.app_role, text) from public, anon;
revoke all on function public.cancel_invitation(uuid) from public, anon;
grant execute on function public.create_invitation(text, identity.app_role, text) to authenticated;
grant execute on function public.cancel_invitation(uuid) to authenticated;

revoke all on function public.begin_accept_invitation(text) from public, anon, authenticated;
revoke all on function public.finish_accept_invitation(text, uuid) from public, anon, authenticated;
revoke all on function public.lookup_auth_user(text) from public, anon, authenticated;
grant execute on function public.begin_accept_invitation(text) to service_role;
grant execute on function public.finish_accept_invitation(text, uuid) to service_role;
grant execute on function public.lookup_auth_user(text) to service_role;