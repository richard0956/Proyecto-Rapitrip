-- Cuenta
create table identity.profiles (
  id uuid primary key,                       -- = auth.users.id, sin FK a propósito
  status identity.account_status not null default 'activa',
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz,
  anonymization_candidate_since timestamptz,
  anonymized_at timestamptz,
  anonymized_by uuid
);

create table identity.profile_pii (
  user_id uuid primary key references identity.profiles(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  updated_at timestamptz not null default now()
);

-- Ancla de alcance para el rol comercio. El módulo de comercios la ampliará.
create table identity.commerces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'activo' check (status in ('activo', 'suspendido')),
  created_at timestamptz not null default now()
);

create table identity.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references identity.profiles(id),
  role identity.app_role not null,
  commerce_id uuid references identity.commerces(id),
  status identity.role_status not null default 'activo',
  granted_by uuid references identity.profiles(id),
  granted_at timestamptz not null default now(),
  status_reason text,
  status_changed_at timestamptz,
  status_changed_by uuid,
  constraint comercio_requires_commerce check ((role = 'comercio') = (commerce_id is not null))
);
create unique index user_roles_one_live_role
  on identity.user_roles (user_id, role) where status <> 'revocado';
create unique index user_roles_one_account_per_commerce
  on identity.user_roles (commerce_id) where role = 'comercio' and status <> 'revocado';
create unique index user_roles_one_commerce_per_account
  on identity.user_roles (user_id) where role = 'comercio' and status <> 'revocado';

-- Ficha del repartidor (sin cuenta de acceso en F1)
create table identity.couriers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  vehicle_type text not null,
  document_path text,
  status text not null default 'activo' check (status in ('activo', 'inactivo')),
  user_id uuid references identity.profiles(id),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table identity.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role identity.app_role not null check (role in ('admin', 'cajero', 'coordinador')),
  invited_by uuid not null references identity.profiles(id),
  token_hash text not null unique,
  status identity.invitation_status not null default 'pendiente',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid
);
create unique index invitations_one_pending
  on identity.invitations (lower(email), role) where status = 'pendiente';

create table identity.commerce_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references identity.profiles(id),
  business_name text not null,
  details jsonb not null default '{}'::jsonb,
  status identity.request_status not null default 'pendiente',
  decision_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  commerce_id uuid references identity.commerces(id),
  created_at timestamptz not null default now()
);
create unique index commerce_requests_one_pending
  on identity.commerce_requests (requester_id) where status = 'pendiente';

alter table identity.profiles enable row level security;
alter table identity.profile_pii enable row level security;
alter table identity.commerces enable row level security;
alter table identity.user_roles enable row level security;
alter table identity.couriers enable row level security;
alter table identity.invitations enable row level security;
alter table identity.commerce_requests enable row level security;

revoke all on all tables in schema identity from public, anon, authenticated, service_role;

-- Alta automática de cuentas
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into identity.profiles (id, last_sign_in_at) values (new.id, new.last_sign_in_at);
  insert into identity.profile_pii (user_id, full_name, email)
    values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  insert into identity.user_roles (user_id, role) values (new.id, 'cliente');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.sync_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update identity.profiles
      set last_sign_in_at = new.last_sign_in_at, anonymization_candidate_since = null
      where id = new.id;
  end if;
  if new.email is distinct from old.email then
    update identity.profile_pii set email = new.email, updated_at = now() where user_id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_updated
  after update of email, last_sign_in_at on auth.users
  for each row execute function private.sync_user();