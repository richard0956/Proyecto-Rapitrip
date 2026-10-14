-- Esquemas del dominio. Solo `public` se expone por la API.
create schema if not exists identity;
create schema if not exists audit;
create schema if not exists private;

revoke all on schema identity, audit, private from public, anon, authenticated;
-- `authenticated` necesita USAGE para que las políticas RLS y las vistas con
-- security_invoker puedan resolver nombres. Los privilegios de tabla y de
-- función se conceden uno por uno en cada migración.
grant usage on schema identity, audit, private to authenticated;

-- Nada nuevo es accesible por defecto.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema identity, audit, private revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema identity, audit, private revoke all on sequences from anon, authenticated, service_role;

-- Tipos
create type identity.app_role as enum
  ('superadmin', 'admin', 'cajero', 'coordinador', 'comercio', 'cliente');
create type identity.role_status as enum ('activo', 'suspendido', 'revocado');
create type identity.account_status as enum ('activa', 'anonimizada');
create type identity.request_status as enum ('pendiente', 'aprobada', 'rechazada');
create type identity.invitation_status as enum ('pendiente', 'aceptada', 'cancelada', 'vencida');

create type audit.incident_type as enum ('seguridad', 'interrupcion');
create type audit.incident_origin as enum ('automatico', 'manual');
create type audit.incident_severity as enum ('baja', 'media', 'alta');
create type audit.incident_status as enum ('abierto', 'en_atencion', 'resuelto');