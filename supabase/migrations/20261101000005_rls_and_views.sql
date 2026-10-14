-- profiles
create policy profiles_select_own on identity.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_select_admin on identity.profiles
  for select to authenticated using (private.is_admin_console());

-- profile_pii: la propia fila, o las cuentas con rol operativo para admin y superadmin.
-- Los datos de clientes solo se leen por RPC auditada.
create policy pii_select_own on identity.profile_pii
  for select to authenticated using (user_id = auth.uid());
create policy pii_select_staff_accounts on identity.profile_pii
  for select to authenticated using (
    private.is_admin_console()
    and exists (
      select 1 from identity.user_roles ur
      where ur.user_id = profile_pii.user_id and ur.role <> 'cliente' and ur.status <> 'revocado')
  );

-- user_roles
create policy roles_select_own on identity.user_roles
  for select to authenticated using (user_id = auth.uid());
create policy roles_select_admin on identity.user_roles
  for select to authenticated using (private.is_admin_console());

-- commerces
create policy commerces_select_own on identity.commerces
  for select to authenticated using (private.has_role('comercio', id));
create policy commerces_select_admin on identity.commerces
  for select to authenticated using (private.is_admin_console());

-- couriers (sin document_path)
create policy couriers_select_ops on identity.couriers
  for select to authenticated using (private.is_ops_console());

-- invitations (sin token_hash)
create policy invitations_select_admin on identity.invitations
  for select to authenticated using (private.is_admin_console());

-- commerce_requests
create policy requests_select_own on identity.commerce_requests
  for select to authenticated using (requester_id = auth.uid());
create policy requests_select_admin on identity.commerce_requests
  for select to authenticated using (private.is_admin_console());

-- audit: inicios de sesión propios e incidentes. audit.events no tiene política.
create policy login_events_select_own on audit.login_events
  for select to authenticated using (user_id = auth.uid());
create policy incidents_select_admin on audit.it_incidents
  for select to authenticated using (private.is_admin_console());

grant select on
  identity.profiles, identity.profile_pii, identity.user_roles,
  identity.commerces, identity.commerce_requests,
  audit.login_events, audit.it_incidents
to authenticated;
grant select (id, full_name, phone, vehicle_type, status, user_id, created_at, updated_at)
  on identity.couriers to authenticated;
grant select (id, email, role, invited_by, status, expires_at, created_at, accepted_at)
  on identity.invitations to authenticated;

-- Vistas que consumen las aplicaciones. Respetan RLS porque corren con los permisos de quien consulta.
create view public.my_profile with (security_invoker = true) as
  select p.id, p.status, p.created_at, p.last_sign_in_at, pii.full_name, pii.email, pii.phone
  from identity.profiles p
  join identity.profile_pii pii on pii.user_id = p.id
  where p.id = auth.uid();

create view public.my_roles with (security_invoker = true) as
  select ur.id, ur.role, ur.commerce_id, ur.status, ur.granted_at
  from identity.user_roles ur
  where ur.user_id = auth.uid();

create view public.accounts_staff with (security_invoker = true) as
  select p.id as user_id, pii.full_name, pii.email, p.status as account_status,
         ur.role, ur.status as role_status, ur.commerce_id, ur.granted_at
  from identity.user_roles ur
  join identity.profiles p on p.id = ur.user_id
  join identity.profile_pii pii on pii.user_id = p.id
  where ur.role <> 'cliente';

create view public.couriers_list with (security_invoker = true) as
  select id, full_name, phone, vehicle_type, status, user_id, created_at
  from identity.couriers;

create view public.commerce_requests_list with (security_invoker = true) as
  select id, requester_id, business_name, status, decision_reason, created_at, reviewed_at, commerce_id
  from identity.commerce_requests;

create view public.it_incidents_list with (security_invoker = true) as
  select id, type, origin, severity, description, status, resolution, created_at, resolved_at
  from audit.it_incidents;

create view public.invitations_list with (security_invoker = true) as
  select id, email, role, invited_by, status, expires_at, created_at, accepted_at
  from identity.invitations;

revoke all on
  public.my_profile, public.my_roles, public.accounts_staff, public.couriers_list,
  public.commerce_requests_list, public.it_incidents_list, public.invitations_list
from public, anon;
grant select on
  public.my_profile, public.my_roles, public.accounts_staff, public.couriers_list,
  public.commerce_requests_list, public.it_incidents_list, public.invitations_list
to authenticated;