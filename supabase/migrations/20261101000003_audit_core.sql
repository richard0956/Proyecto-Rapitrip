create table audit.events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_role identity.app_role,
  action text not null,
  target_type text,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  device text,
  metadata jsonb not null default '{}'::jsonb
);
create index events_occurred_idx on audit.events (occurred_at desc);
create index events_actor_idx on audit.events (actor_id, occurred_at desc);
create index events_action_idx on audit.events (action, occurred_at desc);
create index events_target_idx on audit.events (target_type, target_id);

create table audit.login_events (
  id bigint generated always as identity primary key,
  source_audit_id uuid unique,
  user_id uuid,
  occurred_at timestamptz not null,
  result text not null check (result in ('exitoso', 'fallido')),
  provider text,
  ip_address text,
  user_agent text
);
create index login_events_user_idx on audit.login_events (user_id, occurred_at desc);

create table audit.it_incidents (
  id uuid primary key default gen_random_uuid(),
  type audit.incident_type not null,
  origin audit.incident_origin not null,
  severity audit.incident_severity not null,
  description text not null check (char_length(description) between 5 and 2000),
  status audit.incident_status not null default 'abierto',
  resolution text,
  reported_by uuid,
  handled_by uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint resolved_requires_resolution check (status <> 'resuelto' or resolution is not null)
);

alter table audit.events enable row level security;
alter table audit.login_events enable row level security;
alter table audit.it_incidents enable row level security;
revoke all on all tables in schema audit from public, anon, authenticated, service_role;

-- Inmutabilidad
create or replace function audit.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'la tabla audit.% es de solo inserción (%)', tg_table_name, tg_op
    using errcode = '42501';
end $$;

create trigger events_no_update_delete before update or delete on audit.events
  for each row execute function audit.block_mutation();
create trigger events_no_truncate before truncate on audit.events
  for each statement execute function audit.block_mutation();
create trigger login_events_no_update_delete before update or delete on audit.login_events
  for each row execute function audit.block_mutation();
create trigger login_events_no_truncate before truncate on audit.login_events
  for each statement execute function audit.block_mutation();
create trigger incidents_no_delete before delete on audit.it_incidents
  for each row execute function audit.block_mutation();
create trigger incidents_no_truncate before truncate on audit.it_incidents
  for each statement execute function audit.block_mutation();

-- La auditoría guarda ids y nombres de campos, nunca valores personales.
create or replace function private.assert_no_pii(p_data jsonb)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_data is not null and p_data::text ~* '"(email|full_name|phone|document_path|password|token|token_hash)"\s*:' then
    raise exception 'el payload de auditoría contiene una clave de datos personales'
      using errcode = '22023';
  end if;
end $$;

create or replace function private.write_audit(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role identity.app_role;
  v_headers jsonb := nullif(current_setting('request.headers', true), '')::jsonb;
  v_id bigint;
begin
  perform private.assert_no_pii(p_before);
  perform private.assert_no_pii(p_after);
  perform private.assert_no_pii(p_metadata);

  if v_actor is not null then
    select min(ur.role) into v_role
    from identity.user_roles ur
    where ur.user_id = v_actor and ur.status = 'activo';
  end if;

  insert into audit.events (actor_id, actor_role, action, target_type, target_id,
                            before_data, after_data, reason, device, metadata)
  values (v_actor, v_role, p_action, p_target_type, p_target_id, p_before, p_after, p_reason,
          left(concat_ws(' | ', v_headers ->> 'user-agent', v_headers ->> 'x-forwarded-for'), 300),
          coalesce(p_metadata, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function private.write_audit(text, text, text, jsonb, jsonb, text, jsonb) from public;