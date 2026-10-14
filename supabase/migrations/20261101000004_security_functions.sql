-- Matriz de gestión de roles (superadmin solo se otorga por código)
create table private.role_management (
  manager identity.app_role not null,
  target identity.app_role not null,
  primary key (manager, target)
);
alter table private.role_management enable row level security;
revoke all on private.role_management from public, anon, authenticated, service_role;
insert into private.role_management (manager, target) values
  ('superadmin', 'admin'), ('superadmin', 'cajero'), ('superadmin', 'coordinador'),
  ('superadmin', 'comercio'), ('superadmin', 'cliente'),
  ('admin', 'cajero'), ('admin', 'coordinador'), ('admin', 'comercio'), ('admin', 'cliente');

-- Última actividad por sesión (la llena la consola con touch_session)
create table private.session_activity (
  session_id uuid primary key,
  user_id uuid not null,
  last_activity_at timestamptz not null default now()
);
alter table private.session_activity enable row level security;
revoke all on private.session_activity from public, anon, authenticated, service_role;

create or replace function private.jwt_claims()
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;

create or replace function private.role_can_manage(p_manager identity.app_role, p_target identity.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.role_management where manager = p_manager and target = p_target);
$$;

create or replace function private.has_role(p_role identity.app_role, p_commerce uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from identity.user_roles ur
    join identity.profiles p on p.id = ur.user_id
    left join identity.commerces c on c.id = ur.commerce_id
    where ur.user_id = auth.uid()
      and ur.role = p_role
      and ur.status = 'activo'
      and p.status = 'activa'
      and (ur.commerce_id is null or c.status = 'activo')
      and (p_commerce is null or ur.commerce_id = p_commerce)
  );
$$;

create or replace function private.has_any_role(p_roles identity.app_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from identity.user_roles ur
    join identity.profiles p on p.id = ur.user_id
    left join identity.commerces c on c.id = ur.commerce_id
    where ur.user_id = auth.uid()
      and ur.role = any (p_roles)
      and ur.status = 'activo'
      and p.status = 'activa'
      and (ur.commerce_id is null or c.status = 'activo')
  );
$$;

create or replace function private.can_manage(p_target identity.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from identity.user_roles ur
    join identity.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.status = 'activo'
      and p.status = 'activa'
      and private.role_can_manage(ur.role, p_target)
  );
$$;

-- Sesión de consola: contraseña + segundo factor + actividad en los últimos 15 minutos.
create or replace function private.has_strong_session()
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_claims jsonb := private.jwt_claims();
  v_sid uuid;
begin
  if auth.uid() is null then return false; end if;
  if coalesce(v_claims ->> 'aal', '') <> 'aal2' then return false; end if;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(v_claims -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' = 'password'
  ) then return false; end if;
  begin
    v_sid := nullif(v_claims ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if v_sid is null then return false; end if;
  return exists (
    select 1
    from private.session_activity sa
    join identity.profiles p on p.id = sa.user_id
    where sa.session_id = v_sid
      and sa.user_id = auth.uid()
      and p.status = 'activa'
      and sa.last_activity_at > now() - interval '15 minutes'
  );
end $$;

create or replace function private.has_recent_mfa(p_minutes int)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from jsonb_array_elements(coalesce(private.jwt_claims() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' = 'totp'
      and (a ->> 'timestamp')::bigint >= extract(epoch from now())::bigint - p_minutes * 60
  );
$$;

create or replace function private.require_console_session()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_strong_session() then
    raise exception 'se requiere sesión de consola: contraseña, segundo factor y actividad reciente'
      using errcode = '42501';
  end if;
end $$;

create or replace function private.is_admin_console()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_any_role(array['admin', 'superadmin']::identity.app_role[])
     and private.has_strong_session();
$$;

create or replace function private.is_ops_console()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_any_role(array['admin', 'superadmin', 'coordinador', 'cajero']::identity.app_role[])
     and private.has_strong_session();
$$;

-- Solo las funciones que usan las políticas RLS son ejecutables por authenticated.
grant execute on function
  private.has_role(identity.app_role, uuid),
  private.has_any_role(identity.app_role[]),
  private.has_strong_session(),
  private.is_admin_console(),
  private.is_ops_console()
to authenticated;

-- La consola registra actividad real de la persona (clic, tecla, navegación).
create or replace function public.touch_session()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_sid uuid;
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  begin
    v_sid := nullif(private.jwt_claims() ->> 'session_id', '')::uuid;
  exception when invalid_text_representation then
    v_sid := null;
  end;
  if v_sid is null then
    raise exception 'el token no trae session_id' using errcode = '22023';
  end if;
  insert into private.session_activity (session_id, user_id, last_activity_at)
  values (v_sid, auth.uid(), now())
  on conflict (session_id) do update set last_activity_at = now()
    where private.session_activity.user_id = auth.uid();
end $$;

revoke all on function public.touch_session() from public, anon;
grant execute on function public.touch_session() to authenticated;