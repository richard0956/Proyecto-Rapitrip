create or replace function private.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_roles jsonb;
begin
  select coalesce(
           jsonb_agg(jsonb_build_object('role', ur.role, 'commerce_id', ur.commerce_id) order by ur.granted_at),
           '[]'::jsonb)
    into v_roles
  from identity.user_roles ur
  where ur.user_id = (event ->> 'user_id')::uuid and ur.status = 'activo';

  return jsonb_build_object('claims', jsonb_set(event -> 'claims', '{app_roles}', v_roles));
end $$;

grant usage on schema private to supabase_auth_admin;
revoke all on function private.custom_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function private.custom_access_token_hook(jsonb) to supabase_auth_admin;